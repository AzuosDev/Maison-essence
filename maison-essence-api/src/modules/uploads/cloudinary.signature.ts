import { createHash } from 'node:crypto';

/**
 * Parametros que vao assinados. Numero vira texto na serializacao, como o
 * Cloudinary faz do outro lado ao conferir.
 */
export type SignableParams = Readonly<Record<string, string | number>>;

/**
 * Monta a string que sera assinada.
 *
 * O formato e ditado pelo Cloudinary: pares `chave=valor` ordenados pelo nome
 * da chave e unidos por `&`. Qualquer divergencia — uma chave fora de ordem,
 * um valor vazio incluido — produz uma assinatura que o servidor recusa com
 * "Invalid Signature", sem dizer qual parametro errou.
 *
 * Valor vazio fica de fora porque o navegador tambem nao o envia, e o que se
 * assina precisa ser exatamente o que sera enviado.
 */
export function serializeParams(params: SignableParams): string {
  return Object.entries(params)
    .filter(([, value]) => value !== '' && value !== undefined)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

/**
 * Assina os parametros de uma chamada ao Cloudinary.
 *
 * O segredo entra concatenado no fim da string, sem separador, e o digest e
 * SHA-1 em hexadecimal — o padrao que o Cloudinary espera quando a conta nao
 * pede SHA-256.
 *
 * Tres parametros nunca entram aqui, porque o Cloudinary os exclui ao
 * conferir: `file`, `api_key` e `cloud_name` (e `resource_type`, que viaja no
 * caminho da URL). Incluir qualquer um deles invalida a assinatura.
 */
export function signParams(params: SignableParams, apiSecret: string): string {
  return createHash('sha1')
    .update(`${serializeParams(params)}${apiSecret}`)
    .digest('hex');
}
