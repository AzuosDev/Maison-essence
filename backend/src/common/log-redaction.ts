/**
 * O que nunca pode aparecer num log, e como ele aparece quando aparece.
 *
 * A regra e do projeto e vale para qualquer linha: senha, token, hash de
 * sessao, chave PIX e telefone completo ficam de fora. Log nao e uma base
 * segura — ele e copiado para o painel do provedor, aparece em print de tela,
 * e fica legivel para quem tem acesso de leitura e nenhuma credencial do
 * sistema. Um access token inteiro num log e uma sessao entregue.
 *
 * As funcoes daqui sao aplicadas em duas alturas: na origem, por quem sabe o
 * que esta escrevendo (`maskPhone`), e sobre a linha ja montada, como ultima
 * rede (`redactSensitive` no `JsonLogger`). A segunda existe porque a primeira
 * depende de alguem lembrar.
 */

/** O que substitui o valor escondido. */
const HIDDEN = '[redigido]';

/**
 * Telefone: sobra o DDD e os dois ultimos digitos.
 *
 * O suficiente para reconhecer o pedido no log ("e o cliente de Fortaleza que
 * termina em 21") e insuficiente para ligar para alguem ou procurar a pessoa
 * em outro lugar. Numero com menos de seis digitos nao e telefone — some
 * inteiro, porque ai nao ha o que preservar.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  // O 55 da frente e o pais, e nao o DDD: tirado antes, o que sobra
  // mascarado ainda diz de qual cidade veio o numero.
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;

  if (local.length < 6) {
    return HIDDEN;
  }

  const ddd = local.slice(0, 2);
  const tail = local.slice(-2);
  const hidden = '*'.repeat(local.length - 4);

  return `${ddd}${hidden}${tail}`;
}

/**
 * Tudo o que parece segredo, escondido na linha ja pronta.
 *
 * A ordem importa: o token JWT vem antes do hash porque as duas primeiras
 * partes dele passariam pelo teste de "texto longo em base64", e o telefone
 * vem por ultimo porque as regras anteriores ja tiraram de circulacao os
 * numeros longos que nao sao telefone.
 *
 * Erra para o lado de esconder demais, de proposito: um id de pedido lido
 * como telefone atrapalha uma investigacao, um telefone lido como id vaza o
 * numero de um cliente.
 */
export function redactSensitive(line: string): string {
  return line
    // JWT: tres blocos base64url separados por ponto, comecando pelo cabecalho.
    .replace(/eyJ[\w-]{4,}\.[\w-]{8,}\.[\w-]{8,}/g, '[token]')
    // Senha em JSON ou em query string, com ou sem acento no nome do campo.
    .replace(/("(?:senha|password)"\s*:\s*)"[^"]*"/gi, `$1"${HIDDEN}"`)
    .replace(/\b(senha|password)=[^\s&"]+/gi, `$1=${HIDDEN}`)
    // Credencial dentro de uma URI de conexao (mongodb://usuario:senha@...).
    .replace(/:\/\/[^\s:/@]+:[^\s:/@]+@/g, `://${HIDDEN}@`)
    // Hash de sessao, chave de rate limit, segredo em hexadecimal.
    .replace(/\b[0-9a-f]{32,}\b/gi, '[hash]')
    // Telefone brasileiro, escrito de qualquer jeito.
    .replace(/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g, (match) =>
      maskPhone(match),
    );
}
