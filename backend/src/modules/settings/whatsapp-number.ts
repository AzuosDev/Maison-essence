import { Transform } from 'class-transformer';
import { Matches, MaxLength } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

/**
 * O numero do WhatsApp da loja, em um lugar so.
 *
 * E o campo mais importante das configuracoes: todo pedido termina em um link
 * `wa.me/<numero>`, e o `wa.me` so aceita digitos — codigo do pais, DDD e
 * numero, sem `+`, sem parentese, sem traco e sem espaco. Um numero gravado
 * como "(88) 99999-9999" nao da erro no painel: da erro na mao do cliente,
 * na hora de enviar o pedido, e ninguem fica sabendo.
 *
 * Por isso a regra aqui faz as duas coisas. Normaliza o que da para
 * normalizar — a dona vai colar o numero do jeito que o celular dela mostra —
 * e recusa o resto com uma mensagem que diz o formato esperado.
 */

/** Digitos minimos e maximos de um numero internacional (E.164). */
export const MIN_WHATSAPP_DIGITS = 12;
export const MAX_WHATSAPP_DIGITS = 15;

/** Ja normalizado: so digitos, com codigo do pais na frente. */
export const WHATSAPP_NUMBER_PATTERN = new RegExp(
  String.raw`^(?:\d{${MIN_WHATSAPP_DIGITS},${MAX_WHATSAPP_DIGITS}})?$`,
);

export const WHATSAPP_NUMBER_MESSAGE =
  'o número do WhatsApp deve estar no formato internacional, só com digitos, começando pelo código do pais: 5588999999999. Envie vazio para remover o número.';

/** Codigo do pais assumido quando o numero vem sem ele. */
const DEFAULT_COUNTRY_CODE = '55';

/** Numero brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/** Pontuacao que a dona cola junto com o numero e que o `wa.me` nao aceita. */
const PUNCTUATION = /[\s().+-]/g;

/**
 * Devolve o numero em formato internacional, ou `null` quando o que veio nao
 * e um numero de telefone.
 *
 * Vazio e resposta valida e significa "a loja nao tem WhatsApp configurado" —
 * o estado em que ela nasce, antes do primeiro acesso ao painel.
 *
 * O `55` so e acrescentado quando o numero tem a cara de um numero brasileiro
 * sem o pais (DDD valido e 8 ou 9 digitos depois). Numero que ja vem com
 * codigo de pais passa intacto: a loja e de Sobral, mas o fornecedor da dona
 * pode nao ser.
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

/** O link que abre a conversa. Vazio quando nao ha numero configurado. */
export function whatsappLinkOf(number: string): string {
  return number === '' ? '' : `https://wa.me/${number}`;
}

/**
 * Valida o campo no DTO, normalizando antes.
 *
 * A normalizacao devolve o valor original quando falha — e nao uma string
 * vazia — para que o erro que o painel recebe seja sobre o que a dona
 * digitou, com a mensagem explicando o formato, em vez de um silencioso
 * "numero removido".
 */
export const IsWhatsappNumber = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => normalizeWhatsappNumber(value) ?? value),
    MaxLength(MAX_WHATSAPP_DIGITS, { message: WHATSAPP_NUMBER_MESSAGE }),
    Matches(WHATSAPP_NUMBER_PATTERN, { message: WHATSAPP_NUMBER_MESSAGE }),
  );
