import type { CartQuote, InstallmentOption } from '@/features/cart';

/**
 * A parcela escolhida, quando ela acrescenta juros ao total.
 *
 * O `totalCents` da cotação e o preço a vista: itens, desconto e frete. A
 * taxa da maquininha não entra nele por decisão de domínio — e ela que o
 * pedido grava, que a mensagem do WhatsApp escreve em `*TOTAL*` e que o
 * `409` compara quando o catálogo muda no meio do caminho.
 *
 * Só que o cliente que escolheu "2x de R$ 313,01 · total R$ 626,02" vai
 * pagar R$ 626,02, e um resumo que responde R$ 587,90 ao lado da escolha
 * dele parece erro de conta. Esta função e o que permite ao resumo mostrar
 * os dois números com o rótulo de cada um, em vez de esconder o segundo.
 *
 * `null` nos três casos em que não há segundo número a mostrar: PIX ou
 * cartão sem modalidade escolhida (não há parcela selecionada), parcela sem
 * juros (o financiado e o próprio total) e total ainda não resolvido — antes
 * da escolha de entrega a lista de parcelas foi calculada sobre uma taxa que
 * não e de ninguém.
 */
export function financedInstallment(
  quote: CartQuote | undefined,
  totalsResolved: boolean,
): InstallmentOption | null {
  const selected = quote?.payment.selected ?? null;

  if (!totalsResolved || selected === null || !selected.hasInterest) {
    return null;
  }

  return selected;
}
