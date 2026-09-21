/**
 * Regra de desconto por quantidade, ja sem os ids: so o que a resolucao usa.
 * Vem de `QuantityDiscount`, que aponta para um produto ou para uma categoria.
 */
export interface QuantityDiscountRule {
  productId: string | null;
  categoryId: string | null;
  minQty: number;
  percentOff: number;
}

/** Um degrau da escada: "leve 3 e ganhe 10%". */
export interface QuantityDiscountTier {
  minQty: number;
  percentOff: number;
}

/**
 * A escada de desconto de um produto, do primeiro degrau ao ultimo.
 *
 * Duas regras podem valer para o mesmo produto — uma dele e outra da
 * categoria. Elas nunca se somam: em cada quantidade vence a de maior
 * desconto, e e isso que o agrupamento por `minQty` faz.
 *
 * Degrau que nao melhora o anterior sai fora. Uma regra de categoria que da
 * 5% a partir de 6 unidades, num produto que ja tem 10% a partir de 3, nao e
 * degrau nenhum: anunciar "leve 6 e ganhe 5%" faria o cliente achar que
 * comprar mais sai pior.
 */
export function discountLadder(
  rules: readonly QuantityDiscountRule[],
  productId: string,
  categoryIds: readonly string[],
): QuantityDiscountTier[] {
  const categories = new Set(categoryIds);
  const best = new Map<number, number>();

  for (const rule of rules) {
    const applies =
      rule.productId === productId ||
      (rule.categoryId !== null && categories.has(rule.categoryId));

    if (!applies) {
      continue;
    }

    best.set(rule.minQty, Math.max(best.get(rule.minQty) ?? 0, rule.percentOff));
  }

  const ladder: QuantityDiscountTier[] = [];
  let ceiling = 0;

  for (const [minQty, percentOff] of [...best.entries()].sort(([a], [b]) => a - b)) {
    if (percentOff <= ceiling) {
      continue;
    }

    ceiling = percentOff;
    ladder.push({ minQty, percentOff });
  }

  return ladder;
}

/**
 * O degrau que o card anuncia: o primeiro, de menor quantidade.
 *
 * E a chamada mais barata de atender — "leve 3 e ganhe 10%" convence quem
 * esta olhando a vitrine; "leve 12 e ganhe 20%" so assusta.
 */
export function entryTier(ladder: readonly QuantityDiscountTier[]): QuantityDiscountTier | null {
  return ladder[0] ?? null;
}
