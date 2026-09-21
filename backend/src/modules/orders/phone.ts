import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/**
 * O telefone do cliente, em um lugar so.
 *
 * E o campo mais importante do pedido depois dos itens: e por ele que a dona
 * responde no WhatsApp, e e ele que liga o pedido feito como convidado a conta
 * criada depois. Guardado torto, nao da erro nenhum — da uma conversa que
 * nunca comeca.
 *
 * Por isso a regra faz as duas coisas, como a do numero da loja. Normaliza o
 * que da para normalizar, porque o cliente vai digitar do jeito que o teclado
 * do celular sugere — `(88) 99999-9999`, `+55 88 99999 9999`, `88999999999` —
 * e recusa o que nao e celular brasileiro com DDD.
 */

/** Guardado sempre assim: DDD mais nove digitos, sem o codigo do pais. */
export const PHONE_PATTERN = /^\d{11}$/;

/**
 * Celular brasileiro: DDD de 11 a 99 e o nono digito.
 *
 * Nenhum DDD tem zero, nem na frente nem atras — por isso os dois primeiros
 * digitos sao de 1 a 9. O terceiro digito e o `9` que toda operadora passou a
 * exigir em celular: fixo de oito digitos nao entra, e nao e descuido — a
 * mensagem do pedido vai para o WhatsApp, e o numero que nao recebe WhatsApp
 * nao serve ao unico canal de atendimento que a loja tem.
 */
const BRAZILIAN_MOBILE = /^[1-9][1-9]9\d{8}$/;

const COUNTRY_CODE = '55';

/** O que o cliente cola junto do numero e que nao e digito. */
const PUNCTUATION = /[\s().+-]/g;

export const PHONE_MESSAGE =
  'informe um celular com DDD, no formato (88) 99999-9999';

/**
 * Devolve o celular em onze digitos, ou `null` quando o que veio nao e um.
 *
 * O `55` da frente e removido quando o resto tem cara de numero brasileiro:
 * quem digita o proprio numero raramente inclui o pais, mas quem cola de um
 * contato salvo quase sempre inclui.
 */
export function normalizeBrazilianPhone(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.trim().replace(PUNCTUATION, '');

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  const local =
    digits.length === 13 && digits.startsWith(COUNTRY_CODE) ? digits.slice(2) : digits;

  return BRAZILIAN_MOBILE.test(local) ? local : null;
}

/** `88999999999` vira `(88) 99999-9999`. So para leitura humana. */
export function formatBrazilianPhone(phone: string): string {
  if (!PHONE_PATTERN.test(phone)) {
    return phone;
  }

  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
}

/**
 * Valida o campo no DTO, normalizando antes.
 *
 * Quando a normalizacao falha o valor original e devolvido — e nao uma string
 * vazia — para que o erro fale do que o cliente digitou, com a mensagem
 * mostrando o formato, em vez de um "campo obrigatorio" que nao explica nada.
 */
export const IsBrazilianPhone = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => normalizeBrazilianPhone(value) ?? value),
    Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }),
  );
