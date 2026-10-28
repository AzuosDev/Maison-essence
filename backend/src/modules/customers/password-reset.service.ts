import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Env } from '../../config/env.schema.js';
import { LOGIN_MIN_DURATION_MS } from '../auth/auth.constants.js';
import { withMinimumDuration } from '../auth/constant-time.js';
import { PasswordService } from '../auth/password.service.js';
import { RefreshTokenService, customerOwner } from '../auth/refresh-token.service.js';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { customerFilterFor, resolveCustomerIdentifier } from './customer-identifier.js';
import {
  FORGOT_PASSWORD_MESSAGE,
  MAX_RESET_ATTEMPTS,
  RESET_TOKEN_INVALID_MESSAGE,
  RESET_TOKEN_TTL_MINUTES,
} from './customers.constants.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import { passwordResetEmail } from './password-reset.email.js';
import { Customer } from './schemas/customer.schema.js';
import type { CustomerDocument } from './schemas/customer.schema.js';
import { PasswordResetToken } from './schemas/password-reset-token.schema.js';

/** A resposta de "esqueci minha senha". Sempre a mesma. */
export interface ForgotPasswordResult {
  message: string;
}

const TOKEN_BYTES = 32;

/**
 * Recuperação de senha do cliente.
 *
 * ## Duas rotas, e a primeira nunca conta nada
 *
 * Pedir recuperação responde 200 com o mesmo texto para conta que existe e
 * conta que não existe, e demora o mesmo tanto nos dois casos. Sem isso, a
 * rota — publica, sem login, aberta na internet — viraria um consultor de
 * quem compra nesta loja: basta perguntar por um telefone de cada vez e
 * reparar em qual responde diferente.
 *
 * O `withMinimumDuration` e o que faz o "demora o mesmo tanto" ser verdade. A
 * conta que existe gasta tempo sorteando token, gravando e falando com o
 * Gmail; a que não existe gastaria quase nada, e a diferença e mensurável do
 * outro lado da rede.
 *
 * ## O envio acontece depois da resposta
 *
 * Falar com o SMTP leva de centenas de milissegundos a alguns segundos, e a
 * pessoa não precisa esperar isso para ler "o link saiu". Mais importante: um
 * SMTP fora do ar não pode virar 500, porque um 500 aqui contaria que aquela
 * conta existe — a que não existe nunca chega a tentar enviar. Por isso
 * `MailService.send` nunca lança, e por isso o resultado dele vira log, e não
 * resposta.
 *
 * ## O token some da memória do servidor
 *
 * O segredo e sorteado, mandado e esquecido: o que fica gravado e o SHA-256
 * dele. Nem o log recebe o token — ver `MailService`, que registra destino e
 * assunto, e só escreve o corpo fora de produção.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(PasswordResetToken.name)
    private readonly resets: Model<PasswordResetToken>,
    private readonly passwords: PasswordService,
    private readonly sessions: RefreshTokenService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Abre um pedido de recuperação e manda o link.
   *
   * O `void` no envio e deliberado: a resposta sai antes do e-mail, e o
   * `catch` existe só para que uma falha ali não vire rejeição não tratada.
   */
  async request(dto: ForgotPasswordDto): Promise<ForgotPasswordResult> {
    await withMinimumDuration(LOGIN_MIN_DURATION_MS, async () => {
      const identity = resolveCustomerIdentifier(dto.identifier);

      if (identity === null) {
        return;
      }

      const customer = await this.customers.findOne(customerFilterFor(identity)).exec();

      // Conta inexistente, desativada, ou sem e-mail gravado — contas antigas
      // podem não ter. Nos três a resposta e a mesma de quem recebeu o link.
      if (!customer || !customer.isActive || customer.email === '') {
        return;
      }

      const link = await this.openRequest(customer);

      void this.deliver(customer, link);
    });

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /**
   * Grava a senha nova apresentando o token, e derruba todas as sessões.
   *
   * Derrubar tudo e o ponto da operação, não um efeito colateral: quem chega
   * aqui pode estar recuperando a conta justamente de alguém que entrou nela.
   * Deixar a sessão do invasor viva enquanto o dono cria senha nova seria
   * trocar a fechadura e deixar a porta aberta.
   *
   * A sessão não e renovada: a pessoa cai na tela de entrar e usa a senha que
   * acabou de criar. Emitir sessão aqui seria entregar acesso a quem
   * apresentou um link de e-mail, sem nunca ter digitado a senha.
   */
  async reset(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const pending = await this.resets
      .findOne({ tokenHash })
      .select('+tokenHash')
      .exec();

    if (!pending) {
      throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
    }

    // `timingSafeEqual` sobre os hashes, e não `===`: a consulta já achou o
    // documento pelo hash, mas comparar de novo em tempo constante e o que
    // mantem a propriedade caso a busca um dia passe a ser por outro campo.
    if (
      !sameHash(pending.tokenHash, tokenHash) ||
      pending.usedAt !== null ||
      pending.attempts >= MAX_RESET_ATTEMPTS ||
      pending.expiresAt.getTime() <= Date.now()
    ) {
      await this.resets.updateOne({ _id: pending._id }, { $inc: { attempts: 1 } }).exec();

      throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
    }

    const customer = await this.customers.findById(pending.customerId).exec();

    if (!customer || !customer.isActive) {
      throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
    }

    /*
     * O token e marcado como usado antes de a senha mudar, e com um filtro que
     * exige que ele ainda esteja em aberto.
     *
     * Dois cliques no mesmo link, ou dois pedidos simultâneos, chegariam aqui
     * juntos: quem perder a corrida não acha mais o documento em aberto e sai
     * com a mesma recusa de link vencido. Sem isso, o segundo gravaria por
     * cima da senha que o primeiro acabou de criar.
     */
    const claimed = await this.resets
      .findOneAndUpdate(
        { _id: pending._id, usedAt: null },
        { $set: { usedAt: new Date() } },
      )
      .exec();

    if (!claimed) {
      throw new BadRequestException(RESET_TOKEN_INVALID_MESSAGE);
    }

    await this.customers
      .updateOne(
        { _id: customer._id },
        {
          $set: { passwordHash: await this.passwords.hash(dto.password) },
          $inc: { credentialVersion: 1 },
        },
      )
      .exec();

    // A versão da credencial já subiu na escrita acima, que e o que derruba
    // os access tokens; aqui só restam os refresh.
    await this.sessions.revokeRefreshTokens(customerOwner(customer._id));

    this.logger.log(`Senha recuperada por e-mail (cliente ${customer._id.toHexString()})`);
  }

  /**
   * Encerra o pedido anterior e abre um novo. Devolve o link pronto.
   *
   * Um pedido em aberto por conta: pedir de novo porque o primeiro e-mail
   * demorou não pode deixar dois links vivos — seriam duas janelas abertas
   * pelo preço de uma, e a pessoa só vai usar a última.
   */
  private async openRequest(customer: CustomerDocument): Promise<string> {
    await this.resets
      .updateMany(
        { customerId: customer._id, usedAt: null },
        { $set: { usedAt: new Date() } },
      )
      .exec();

    const token = randomBytes(TOKEN_BYTES).toString('hex');

    await this.resets.create({
      customerId: customer._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });

    return `${this.storefront()}/conta/senha/nova?token=${token}`;
  }

  /** Monta a mensagem com o nome que a loja usa hoje e manda. */
  private async deliver(customer: CustomerDocument, link: string): Promise<void> {
    try {
      const settings = await this.settings.current();

      await this.mail.send(
        passwordResetEmail({
          to: customer.email,
          name: customer.name,
          link,
          storeName: settings.storeName,
        }),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao montar o e-mail de recuperação (cliente ${customer._id.toHexString()}): ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * A origem da loja, para o link do e-mail.
   *
   * `STOREFRONT_URL` quando existe; senão, a primeira origem do CORS, que em
   * todo ambiente configurado corretamente e a da loja. O fallback evita uma
   * variável a mais para escrever em cada ambiente, e o `STOREFRONT_URL`
   * existe para o caso em que a primeira origem não e a loja.
   */
  private storefront(): string {
    const configured = this.config.get('STOREFRONT_URL', { infer: true });

    if (configured !== undefined) {
      return configured;
    }

    const [first = ''] = this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== '');

    return first;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação de hashes hexadecimais em tempo constante. */
function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');

  return a.length === b.length && timingSafeEqual(a, b);
}
