import type { PublicCard } from './payments.types';

/**
 * A linha de parcelamento do card, calculada no cliente.
 *
 * A conta e a mesma de `payments/installments.ts` no backend, e a igualdade e
 * o ponto: o "3x de R$ 66,33" do card precisa ser exatamente o que o checkout
 * vai oferecer e o que a mensagem do WhatsApp vai registrar. Duas contas
 * parecidas viram uma discussao com o cliente na hora de cobrar.
 *
 * Por que refazer a conta aqui em vez de pedir a parcela pronta: a rota de
 * cotacao precisa da sacola montada, e o card e uma vitrine — vinte produtos
 * numa tela, cada um com o seu preco. As regras sao quatro numeros que vem de
 * `GET /payment-settings` uma vez por visita; a aritmetica em cima deles nao
 * justifica uma ida ao servidor por produto.
 *
 * Tudo em centavos inteiros. O card so anuncia parcela **sem juros** — o
 * financiamento pela tabela price fica na pagina do produto e no checkout,
 * onde ha espaco para mostrar o total financiado ao lado.
 */

export interface Installment {
  /** Quantidade de parcelas. Sempre dois ou mais. */
  count: number;
  /** O valor que se repete — o numero que vem depois do "x". */
  installmentCents: number;
}

/**
 * A melhor parcela sem juros que cabe num preco, ou `null` quando nao cabe
 * nenhuma.
 *
 * Melhor e a maior: "12x de R$ 41,58" convence mais que "2x de R$ 249,50", e
 * as duas custam o mesmo. A busca desce do teto sem juros ate 2x e para na
 * primeira que respeita a parcela minima — a regra que existe para impedir
 * "12x de R$ 1,25" numa vela de R$ 15.
 *
 * `Math.floor`, e nao `Math.round`, como no backend: e o que garante que a
 * sobra de arredondamento seja positiva e caiba na primeira parcela, em vez
 * de faltar centavo no fim.
 */
export function bestInterestFreeInstallment(
  totalCents: number,
  card: PublicCard,
): Installment | null {
  const ceiling = Math.min(card.interestFreeUpTo, card.maxInstallments);

  for (let count = ceiling; count >= 2; count -= 1) {
    const installmentCents = Math.floor(totalCents / count);

    if (installmentCents >= card.minInstallmentCents) {
      return { count, installmentCents };
    }
  }

  return null;
}
