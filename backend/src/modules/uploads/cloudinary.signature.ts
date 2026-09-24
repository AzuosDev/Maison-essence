import { createHash } from 'node:crypto';

/**
 * Parâmetros que vão assinados. Número vira texto na serialização, como o
 * Cloudinary faz do outro lado ao conferir.
 */
export type SignableParams = Readonly<Record<string, string | number>>;

/**
 * Monta a string que será assinada.
 *
 * O formato e ditado pelo Cloudinary: pares `chave=valor` ordenados pelo nome
 * da chave e unidos por `&`. Qualquer divergência — uma chave fora de ordem,
 * um valor vazio incluído — produz uma assinatura que o servidor recusa com
 * "Invalid Signature", sem dizer qual parâmetro errou.
 *
 * Valor vazio fica de fora porque o navegador também não o envia, e o que se
 * assina precisa ser exatamente o que será enviado.
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
 * Assina os parâmetros de uma chamada ao Cloudinary.
 *
 * O segredo entra concatenado no fim da string, sem separador, e o digest e
 * SHA-1 em hexadecimal — o padrão que o Cloudinary espera quando a conta não
 * pede SHA-256.
 *
 * Três parâmetros nunca entram aqui, porque o Cloudinary os exclui ao
 * conferir: `file`, `api_key` e `cloud_name` (e `resource_type`, que viaja no
 * caminho da URL). Incluir qualquer um deles inválida a assinatura.
 */
export function signParams(params: SignableParams, apiSecret: string): string {
  return createHash('sha1')
    .update(`${serializeParams(params)}${apiSecret}`)
    .digest('hex');
}
