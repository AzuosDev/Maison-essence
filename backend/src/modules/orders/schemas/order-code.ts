import { randomInt } from 'node:crypto';

export const ORDER_CODE_PREFIX = 'ME';

/**
 * Fuso da loja.
 *
 * A funcao serverless roda em UTC, entao um pedido feito as 21h de Fortaleza
 * nasceria com a data do dia seguinte. O codigo e lido pela dona no WhatsApp
 * junto do horario da mensagem: as duas datas precisam bater.
 */
export const ORDER_CODE_TIMEZONE = 'America/Sao_Paulo';

/** `ME-250920-4KP1` */
export const ORDER_CODE_PATTERN = /^ME-\d{6}-[0-9A-Z]{4}$/;

const RANDOM_LENGTH = 4;
const RANDOM_RANGE = 36 ** RANDOM_LENGTH;

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ORDER_CODE_TIMEZONE,
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Gera o codigo do pedido no formato `ME-AAMMDD-XXXX`.
 *
 * A parte aleatoria tem 1,6 milhao de combinacoes por dia, o que torna
 * colisao improvavel; quando ela mesmo assim acontecer, o indice unico em
 * `code` rejeita a gravacao e sobra tentar de novo.
 */
export function generateOrderCode(now: Date = new Date()): string {
  return `${ORDER_CODE_PREFIX}-${formatDatePart(now)}-${randomPart()}`;
}

/** `en-CA` formata como `AA-MM-DD`; sobra tirar os hifens. */
function formatDatePart(now: Date): string {
  return DATE_FORMAT.format(now).replace(/\D/g, '');
}

function randomPart(): string {
  return randomInt(RANDOM_RANGE).toString(36).toUpperCase().padStart(RANDOM_LENGTH, '0');
}
