/**
 * Regra de desconto por quantidade, já sem os ids: só o que a resolução usa.
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
 * A escada de desconto de um produto, do primeiro degrau ao último.
 *
 * Duas regras podem valer para o mesmo produto — uma dele e outra da
 * categoria. Elas nunca se somam: em cada quantidade vence a de maior
 * desconto, e e isso que o agrupamento por `minQty` faz.
 *
 * Degrau que não melhora o anterior sai fora. Uma regra de categoria que da
 * 5% a partir de 6 unidades, num produto que já tem 10% a partir de 3, não e
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
 * esta olhando a vitrine; "leve 12 e ganhe 20%" só assusta.
 */
export function entryTier(ladder: readonly QuantityDiscountTier[]): QuantityDiscountTier | null {
  return ladder[0] ?? null;
}

/**
 * O degrau que vale para uma quantidade: o último cujo mínimo ela alcança.
 *
 * `null` quando a quantidade não chega ao primeiro degrau — o caso comum, de
 * quem leva uma unidade. Como a escada já sobe em desconto, percorre-lá até o
 * primeiro degrau grande demais basta: o último alcançado e o melhor
 * aplicável, e nenhum desconto se soma a outro.
 */
export function tierFor(
  ladder: readonly QuantityDiscountTier[],
  quantity: number,
): QuantityDiscountTier | null {
  let best: QuantityDiscountTier | null = null;

  for (const tier of ladder) {
    if (quantity < tier.minQty) {
      break;
    }

    best = tier;
  }

  return best;
}
