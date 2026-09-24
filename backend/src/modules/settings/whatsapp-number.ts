import { Transform } from 'class-transformer';
import { Matches, MaxLength } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

/**
 * O número do WhatsApp da loja, em um lugar só.
 *
 * E o campo mais importante das configurações: todo pedido termina em um link
 * `wa.me/<numero>`, e o `wa.me` só aceita digitos — código do pais, DDD e
 * número, sem `+`, sem parentese, sem traço e sem espaço. Um número gravado
 * como "(88) 99999-9999" não da erro no painel: da erro na mão do cliente,
 * na hora de enviar o pedido, e ninguém fica sabendo.
 *
 * Por isso a regra aqui faz as duas coisas. Normaliza o que da para
 * normalizar — a dona vai colar o número do jeito que o celular dela mostra —
 * e recusa o resto com uma mensagem que diz o formato esperado.
 */

/** Digitos mínimos e máximos de um número internacional (E.164). */
export const MIN_WHATSAPP_DIGITS = 12;
export const MAX_WHATSAPP_DIGITS = 15;

/** Já normalizado: só digitos, com código do pais na frente. */
export const WHATSAPP_NUMBER_PATTERN = new RegExp(
  String.raw`^(?:\d{${MIN_WHATSAPP_DIGITS},${MAX_WHATSAPP_DIGITS}})?$`,
);

export const WHATSAPP_NUMBER_MESSAGE =
  'o número do WhatsApp deve estar no formato internacional, só com digitos, começando pelo código do pais: 5588999999999. Envie vazio para remover o número.';

/** Código do pais assumido quando o número vem sem ele. */
const DEFAULT_COUNTRY_CODE = '55';

/** Número brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/** Pontuação que a dona cola junto com o número e que o `wa.me` não aceita. */
const PUNCTUATION = /[\s().+-]/g;

/**
 * Devolve o número em formato internacional, ou `null` quando o que veio não
 * e um número de telefone.
 *
 * Vazio e resposta valida e significa "a loja não tem WhatsApp configurado" —
 * o estado em que ela nasce, antes do primeiro acesso ao painel.
 *
 * O `55` só e acrescentado quando o número tem a cara de um número brasileiro
 * sem o pais (DDD válido e 8 ou 9 digitos depois). Número que já vem com
 * código de pais passa intacto: a loja e de Sobral, mas o fornecedor da dona
 * pode não ser.
 */
export function normalizeWhatsappNumber(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.trim().replace(PUNCTUATION, '');

  if (digits === '') {
    return '';
  }

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  const international = BRAZILIAN_WITHOUT_COUNTRY.test(digits)
    ? `${DEFAULT_COUNTRY_CODE}${digits}`
    : digits;

  if (
    international.length < MIN_WHATSAPP_DIGITS ||
    international.length > MAX_WHATSAPP_DIGITS
  ) {
    return null;
  }

  return international;
}

/** O link que abre a conversa. Vazio quando não há número configurado. */
export function whatsappLinkOf(number: string): string {
  return number === '' ? '' : `https://wa.me/${number}`;
}

/**
 * Valida o campo no DTO, normalizando antes.
 *
 * A normalização devolve o valor original quando falha — e não uma string
 * vazia — para que o erro que o painel recebe seja sobre o que a dona
 * digitou, com a mensagem explicando o formato, em vez de um silencioso
 * "número removido".
 */
export const IsWhatsappNumber = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => normalizeWhatsappNumber(value) ?? value),
    MaxLength(MAX_WHATSAPP_DIGITS, { message: WHATSAPP_NUMBER_MESSAGE }),
    Matches(WHATSAPP_NUMBER_PATTERN, { message: WHATSAPP_NUMBER_MESSAGE }),
  );
