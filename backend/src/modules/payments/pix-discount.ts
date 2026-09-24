/**
 * O desconto do PIX.
 *
 * Incide sobre o subtotal de produtos e nunca sobre a taxa de entrega. A
 * entrega não e margem da loja: e custo que já foi pago a quem leva, e
 * descontar sobre ela seria a loja pagar para entregar. Por isso a função
 * recebe os dois valores separados em vez de um total já somado — somados,
 * não da mais para saber quanto era frete.
 */

export interface PixQuote {
  /** Quanto o desconto tirou, em centavos. */
  discountCents: number;
  /** O que o cliente paga no PIX: subtotal menos desconto, mais a entrega. */
  totalCents: number;
}

/**
 * O total no PIX e quanto o desconto retirou.
 *
 * `Math.round` na virada do centavo, a favor de quem paga: 5% de R$ 99,99 são
 * R$ 4,9995, e o cliente leva os cinco centavos. O teto de 50% do schema e o
 * que impede o desconto de passar do subtotal.
 */
export function pixQuoteOf(
  subtotalCents: number,
  deliveryFeeCents: number,
  discountPercent: number,
): PixQuote {
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);

  return { discountCents, totalCents: subtotalCents - discountCents + deliveryFeeCents };
}
