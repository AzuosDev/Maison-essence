/**
 * O endereço, escrito como se escreve um endereço.
 *
 * Duas linhas: a rua com o número e o complemento, e o bairro com a cidade,
 * o estado e o CEP. E o formato de etiqueta de correspondência, que e o que
 * alguém consegue ler em voz alta pelo telefone e digitar num aplicativo de
 * mapa.
 *
 * Campo vazio some junto com a pontuação dele. O endereço da loja e
 * preenchido a mão no painel, e nem toda loja tem complemento — uma linha
 * terminando em "Centro, , CE" e o tipo de detalhe que faz o cliente
 * desconfiar do resto da página.
 */

/** O formato em que endereço viaja nesta aplicação. */
export interface PostalAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  reference: string;
}

/** As linhas do endereço, já sem as vazias. */
export function addressLines(address: PostalAddress): string[] {
  const street = join([join([address.street, address.number], ', '), address.complement], ' — ');
  const place = join([address.district, join([address.city, address.state], '/')], ', ');

  return [street, join([place, formatZipCode(address.zipCode)], ' · ')].filter(
    (line) => line !== '',
  );
}

/** `63010000` vira `63010-000`. O que não tem oito digitos passa como esta. */
export function formatZipCode(zipCode: string): string {
  const digits = zipCode.replace(/\D/g, '');

  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : zipCode;
}

function join(parts: readonly string[], separator: string): string {
  return parts.filter((part) => part.trim() !== '').join(separator);
}
