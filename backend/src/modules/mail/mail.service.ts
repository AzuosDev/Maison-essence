import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import type { Env } from '../../config/env.schema.js';

/** Um e-mail pronto para sair. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * O envio de e-mail da loja, pelo SMTP do Gmail.
 *
 * ## Por que SMTP do Gmail, e não um serviço de envio
 *
 * A loja manda e-mail para uma coisa só: recuperar senha. São alguns por
 * semana, não alguns por minuto. O Gmail entrega isso com uma senha de app —
 * sem conta nova, sem domínio para verificar, sem fatura — e o limite dele,
 * uns quinhentos por dia, esta duas ordens de grandeza acima do que esta loja
 * precisa. No dia em que precisar de mais, o que muda e o transporte criado
 * aqui dentro; quem chama continua chamando `send`.
 *
 * ## Sem credencial, escreve no log
 *
 * `EMAIL_USER` e `EMAIL_PASS` são opcionais, e isso e deliberado: a API sobe
 * sem elas, como sobe sem conta de imagens. Em desenvolvimento e no teste e o
 * que se quer — ninguém quer que `npm test` abra conexão SMTP —, e o link de
 * recuperação aparece no log, que e por onde se confere o fluxo inteiro sem
 * caixa de entrada.
 *
 * Em produção, a ausência delas e um defeito silencioso: o cliente pede a
 * recuperação, a tela diz que o e-mail saiu e nada chega. Por isso o aviso no
 * boot — ver `warnIfUnconfigured` — e por isso ele fala em produção e cala
 * fora dela.
 *
 * ## O que nunca vai para o log
 *
 * O corpo da mensagem, não. Ele carrega o token de recuperação, que e uma
 * senha de uso único: logar o corpo inteiro seria guardar, no registro do
 * servidor, a chave que abre a conta. O log diz para quem foi e qual era o
 * assunto. Fora de produção o link vai junto, porque ali ele e a ferramenta.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Criado na primeira mensagem, e não no construtor — e o nodemailer e
   * **importado** junto, não no topo do arquivo.
   *
   * A API roda em função serverless, onde a primeira invocação paga o custo
   * de carregar tudo o que o boot alcança. A maior parte das invocações desta
   * loja e catálogo e carrinho, e nenhuma delas manda e-mail: pôr o
   * nodemailer no caminho de subida faria toda primeira visita pagar por uma
   * biblioteca de SMTP que ela nunca usa.
   *
   * Por isso o `import()` dinâmico lá embaixo. O tipo continua vindo de um
   * `import type`, que o TypeScript apaga na emissão e não vira `require`.
   */
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** A loja consegue mandar e-mail agora. */
  get isConfigured(): boolean {
    return this.user !== undefined && this.password !== undefined;
  }

  /**
   * Manda a mensagem, ou a registra no log quando não há credencial.
   *
   * Nunca lança. Quem chama esta sempre no meio de um fluxo que não deve
   * falhar por causa do correio — pedir recuperação de senha responde a mesma
   * coisa com e sem caixa de entrada do outro lado, de propósito —, e uma
   * exceção aqui viraria um 500 que conta ao visitante que aquele e-mail
   * existe na loja.
   */
  async send(mail: Mail): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn(
        `E-mail não enviado (SMTP não configurado): "${mail.subject}" para ${mail.to}`,
      );
      this.logUnsentBody(mail);

      return false;
    }

    try {
      const transport = await this.transport();

      await transport.sendMail({
        from: this.from(),
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      this.logger.log(`E-mail enviado: "${mail.subject}" para ${mail.to}`);

      return true;
    } catch (error: unknown) {
      // A mensagem do erro, e não o erro inteiro: o nodemailer põe a conversa
      // SMTP na pilha, e nela vai o cabeçalho de autenticação.
      this.logger.error(
        `E-mail falhou: "${mail.subject}" para ${mail.to} — ${messageOf(error)}`,
      );

      return false;
    }
  }

  /**
   * Avisa, uma vez, que a loja não manda e-mail.
   *
   * Chamado no boot. Em produção e um aviso de verdade: alguma pessoa vai
   * pedir recuperação de senha e não receber nada. Fora de produção e o
   * estado normal e não polui a saída.
   */
  warnIfUnconfigured(): void {
    if (this.isConfigured || this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      return;
    }

    this.logger.warn(
      'EMAIL_USER/EMAIL_PASS ausentes: a recuperação de senha do cliente não envia nada. ' +
        'Gere uma senha de app na conta Google da loja e configure as duas.',
    );
  }

  private async transport(): Promise<Transporter> {
    if (this.transporter === null) {
      const { createTransport } = await import('nodemailer');

      this.transporter = createTransport({
        service: 'gmail',
        auth: { user: this.user, pass: this.password },
      });
    }

    return this.transporter;
  }

  /**
   * O remetente, com o nome da loja na frente.
   *
   * O endereço e sempre o da conta autenticada. O Gmail reescreve qualquer
   * outro para o dela, então inventar um aqui só produziria um `From` que não
   * bate com o que chega.
   */
  private from(): string {
    const name = this.config.get('EMAIL_FROM_NAME', { infer: true });

    return `"${name}" <${this.user ?? ''}>`;
  }

  /**
   * O corpo que não saiu, fora de produção.
   *
   * E o que torna o fluxo conferível sem caixa de entrada: o link de
   * recuperação aparece no terminal de quem esta desenvolvendo. Em produção
   * cala, porque ali o mesmo texto seria um token de recuperação gravado no
   * log do provedor.
   */
  private logUnsentBody(mail: Mail): void {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      this.logger.debug(`Corpo da mensagem não enviada:\n${mail.text}`);
    }
  }

  private get user(): string | undefined {
    return this.config.get('EMAIL_USER', { infer: true });
  }

  private get password(): string | undefined {
    return this.config.get('EMAIL_PASS', { infer: true });
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
