/**
 * Telefone, do jeito que o backend guarda e do jeito que a tela mostra.
 *
 * A API grava sempre onze digitos, sem o codigo do pais, e devolve o rotulo
 * pronto em `phoneLabel`. Estas funcoes existem para o outro sentido: o campo
 * de formulario, onde o cliente digita como o teclado do celular sugere.
 *
 * A regra de validacao e a mesma do backend (`orders/phone.ts`), e nao por
 * coincidencia: se a mascara daqui aceitasse um numero que la e recusado, o
 * cliente so descobriria o problema no envio do pedido.
 */

/** Como esta gravado: DDD mais nove digitos. */
const STORED = /^\d{11}$/;

/** Celular brasileiro: DDD sem zero e o nono digito que o WhatsApp exige. */
const MOBILE = /^[1-9][1-9]9\d{8}$/;

const COUNTRY_CODE = '55';

/** `88999999999` vira `(88) 99999-9999`. So para leitura humana. */
export function formatPhone(phone: string): string {
  return STORED.test(phone)
    ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
    : phone;
}

/**
 * Devolve o celular em onze digitos, ou `null` quando o que veio nao e um.
 *
 * O `55` da frente sai quando o resto tem cara de numero brasileiro: quem
 * cola de um contato salvo quase sempre traz o pais junto.
 */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 13 && digits.startsWith(COUNTRY_CODE) ? digits.slice(2) : digits;

  return MOBILE.test(local) ? local : null;
}

/**
 * A mascara enquanto se digita.
 *
 * Nunca recusa tecla nem reordena o que foi digitado — so acrescenta os
 * parenteses e o hifen no lugar. Campo que "conserta" o valor no meio da
 * digitacao e campo que come o ultimo digito de quem esta com pressa.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 5) {
    return `(${ddd}) ${rest}`;
  }

  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** O numero como o `wa.me` quer: com o pais e sem pontuacao. */
export function whatsappNumber(phone: string): string {
  return `${COUNTRY_CODE}${phone.replace(/\D/g, '')}`;
}
