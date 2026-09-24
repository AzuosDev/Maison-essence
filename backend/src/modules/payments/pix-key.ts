import type { PixKeyType } from '../../common/enums/payment-method.js';
import { PIX_KEY_TYPES } from '../../common/enums/payment-method.js';

/**
 * A chave PIX da loja, normalizada e conferida contra o tipo escolhido.
 *
 * O par chave/tipo precisa ser coerente por uma razao que so aparece depois:
 * a rota publica expoe o *tipo* e nunca a chave, entao o cliente le "chave:
 * CPF" e digita onze digitos no aplicativo do banco. Se o que estiver gravado
 * for um e-mail, a transferencia nao acontece e ninguem descobre pelo painel
 * — descobre pelo cliente que desistiu da compra.
 *
 * A normalizacao segue a mesma escolha do numero do WhatsApp: aceita o que a
 * dona colar do jeito que o banco dela mostra — CPF com ponto e traco,
 * telefone com parentese — e guarda no formato que o PIX usa.
 */

/** Chave aleatoria: UUID, do jeito que o banco a entrega. */
const RANDOM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Suficiente para pegar erro de digitacao; o banco valida o resto. */
const EMAIL_KEY = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;

/** Pontuacao que vem colada junto e que a chave nao guarda. */
const PUNCTUATION = /[\s.\-()/+]/g;

/** Telefone em formato internacional, como o PIX o registra: `+5588999999999`. */
const PHONE_DIGITS = /^\d{12,15}$/;

/** Codigo do pais assumido quando o telefone vem sem ele. */
const DEFAULT_COUNTRY_CODE = '55';

/** Telefone brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

export const PIX_KEY_MESSAGES: Record<PixKeyType, string> = {
  [PIX_KEY_TYPES.CPF]: 'a chave PIX do tipo CPF deve ter 11 digitos',
  [PIX_KEY_TYPES.CNPJ]: 'a chave PIX do tipo CNPJ deve ter 14 digitos',
  [PIX_KEY_TYPES.EMAIL]: 'a chave PIX do tipo e-mail deve ser um endereço de e-mail válido',
  [PIX_KEY_TYPES.PHONE]:
    'a chave PIX do tipo telefone deve ter DDD e número, como (88) 99999-9999',
  [PIX_KEY_TYPES.RANDOM]:
    'a chave PIX aleatória e o código de 36 caracteres que o banco gera, como 3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
};

/**
 * A chave no formato em que o PIX a registra, ou `null` quando ela nao
 * corresponde ao tipo escolhido.
 *
 * Vazio e resposta valida: e a loja que ainda nao configurou a chave, estado
 * em que ela nasce.
 */
export function normalizePixKey(value: unknown, type: PixKeyType): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return '';
  }

  if (type === PIX_KEY_TYPES.EMAIL) {
    const email = trimmed.toLowerCase();

    return EMAIL_KEY.test(email) ? email : null;
  }

  if (type === PIX_KEY_TYPES.RANDOM) {
    const random = trimmed.toLowerCase();

    return RANDOM_KEY.test(random) ? random : null;
  }

  const digits = trimmed.replace(PUNCTUATION, '');

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  if (type === PIX_KEY_TYPES.CPF) {
    return digits.length === 11 ? digits : null;
  }

  if (type === PIX_KEY_TYPES.CNPJ) {
    return digits.length === 14 ? digits : null;
  }

  const international = BRAZILIAN_WITHOUT_COUNTRY.test(digits)
    ? `${DEFAULT_COUNTRY_CODE}${digits}`
    : digits;

  // O `+` faz parte da chave de telefone, ao contrario do numero do WhatsApp,
  // onde ele quebraria o link `wa.me`.
  return PHONE_DIGITS.test(international) ? `+${international}` : null;
}

/**
 * A chave PIX reduzida ao que da para mostrar num log.
 *
 * Sobram os quatro ultimos caracteres, que bastam para quem conhece a chave
 * reconhece-la e para a trilha de auditoria provar que ela mudou. A chave
 * inteira num log e o endereco para onde vai o dinheiro da loja, e log e o
 * lugar menos protegido de todo o sistema.
 *
 * Chave vazia continua vazia: nao ha o que esconder, e um `****` no lugar de
 * "nao havia chave" faria a trilha mentir.
 */
export function maskPixKey(key: string): string {
  if (key.length === 0) {
    return '';
  }

  return key.length <= 4 ? '****' : `****${key.slice(-4)}`;
}
