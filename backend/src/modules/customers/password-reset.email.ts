import { RESET_TOKEN_TTL_MINUTES } from './customers.constants.js';
import type { Mail } from '../mail/mail.service.js';

/**
 * O e-mail de recuperação de senha.
 *
 * ## Duas versões do mesmo texto
 *
 * `text` e `html`, e o `text` não e rascunho do outro: e o que aparece na
 * prévia da notificação do celular, e o que alguns clientes de e-mail mostram
 * por padrão, e e o que sobra quando a formatação não carrega. O link inteiro
 * aparece nos dois, escrito por extenso, porque botão que não renderiza vira
 * mensagem sem saída.
 *
 * ## Estilo embutido, e tabela nenhuma
 *
 * Cliente de e-mail não carrega folha de estilo externa e ignora a maior parte
 * do CSS moderno. O que sobrevive em todos e `style` no próprio elemento —
 * daí a feiura do código aqui dentro, que não tem relação com o resto do
 * projeto. Sem imagem e sem fonte remota de propósito: as duas são bloqueadas
 * por padrão em quase toda caixa de entrada, e um e-mail cujo sentido depende
 * delas chega sem sentido.
 *
 * ## O que o texto faz
 *
 * Diz o prazo, porque e curto e quem não souber vai clicar tarde. E diz o que
 * fazer se o pedido não foi seu: nada. Isso e verdade — sem o link, a senha
 * não muda — e e mais útil que uma instrução de segurança genérica que a
 * pessoa não tem como seguir.
 */
export function passwordResetEmail(params: {
  to: string;
  name: string;
  link: string;
  storeName: string;
}): Mail {
  const { to, name, link, storeName } = params;
  const greeting = firstName(name);

  const text = [
    `Olá, ${greeting}.`,
    '',
    `Alguém pediu uma senha nova para a sua conta na ${storeName}. Para criar uma, abra o endereço abaixo:`,
    '',
    link,
    '',
    `O link vale por ${RESET_TOKEN_TTL_MINUTES} minutos e funciona uma vez só.`,
    '',
    'Se não foi você quem pediu, não precisa fazer nada: sua senha continua a mesma enquanto este link não for aberto.',
    '',
    storeName,
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background-color:#f6f4f1;font-family:Helvetica,Arial,sans-serif;color:#1c1a17;">
    <div style="max-width:520px;margin:0 auto;padding:32px;background-color:#ffffff;border-radius:12px;">
      <p style="margin:0 0 16px;font-size:16px;">Olá, ${escapeHtml(greeting)}.</p>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
        Alguém pediu uma senha nova para a sua conta na ${escapeHtml(storeName)}.
        Para criar uma, toque no botão abaixo.
      </p>

      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}"
           style="display:inline-block;padding:14px 28px;font-size:15px;color:#ffffff;text-decoration:none;background-color:#1c1a17;border-radius:999px;">
          Criar senha nova
        </a>
      </p>

      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b645c;">
        O link vale por ${RESET_TOKEN_TTL_MINUTES} minutos e funciona uma vez só.
        Se o botão não abrir, copie este endereço:<br />
        <span style="word-break:break-all;color:#1c1a17;">${escapeHtml(link)}</span>
      </p>

      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b645c;">
        Se não foi você quem pediu, não precisa fazer nada: sua senha continua a
        mesma enquanto este link não for aberto.
      </p>
    </div>
  </body>
</html>`;

  return {
    to,
    subject: `Criar uma senha nova — ${storeName}`,
    text,
    html,
  };
}

/**
 * Só o primeiro nome.
 *
 * "Olá, Felipe de Souza Vasconcelos" soa como cobrança. O cadastro guarda o
 * nome inteiro porque a etiqueta da entrega precisa dele; o e-mail, não.
 */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * O que vai dentro do HTML, neutralizado.
 *
 * O nome vem do cadastro, e cadastro e campo livre: alguém chamado `<b>` não
 * pode quebrar a mensagem, e alguém mal-intencionado não pode plantar uma tag
 * no e-mail que a loja assina.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
