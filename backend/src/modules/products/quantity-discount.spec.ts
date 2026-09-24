import { discountLadder, entryTier, tierFor } from './quantity-discount.js';
import type { QuantityDiscountRule } from './quantity-discount.js';

const PRODUCT = 'p1';
const CATEGORY = 'c1';

function rule(data: Partial<QuantityDiscountRule>): QuantityDiscountRule {
  return { productId: null, categoryId: null, minQty: 3, percentOff: 10, ...data };
}

describe('discountLadder', () => {
  it('pega a regra do próprio produto', () => {
    const rules = [rule({ productId: PRODUCT, minQty: 3, percentOff: 10 })];

    expect(discountLadder(rules, PRODUCT, [])).toEqual([{ minQty: 3, percentOff: 10 }]);
  });

  it('pega a regra de uma categoria do produto', () => {
    const rules = [rule({ categoryId: CATEGORY, minQty: 2, percentOff: 5 })];

    expect(discountLadder(rules, PRODUCT, [CATEGORY])).toEqual([{ minQty: 2, percentOff: 5 }]);
  });

  it('ignora regra de outro produto e de categoria que não e dele', () => {
    const rules = [
      rule({ productId: 'outro' }),
      rule({ categoryId: 'outra' }),
    ];

    expect(discountLadder(rules, PRODUCT, [CATEGORY])).toEqual([]);
  });

  it('na mesma quantidade vence o maior desconto, sem somar', () => {
    const rules = [
      rule({ productId: PRODUCT, minQty: 3, percentOff: 10 }),
      rule({ categoryId: CATEGORY, minQty: 3, percentOff: 15 }),
    ];

    expect(discountLadder(rules, PRODUCT, [CATEGORY])).toEqual([{ minQty: 3, percentOff: 15 }]);
  });

  it('monta a escada em ordem de quantidade', () => {
    const rules = [
      rule({ productId: PRODUCT, minQty: 6, percentOff: 15 }),
      rule({ productId: PRODUCT, minQty: 3, percentOff: 10 }),
    ];

    expect(discountLadder(rules, PRODUCT, [])).toEqual([
      { minQty: 3, percentOff: 10 },
      { minQty: 6, percentOff: 15 },
    ]);
  });

  it('descarta degrau que não melhora o anterior', () => {
    const rules = [
      rule({ productId: PRODUCT, minQty: 3, percentOff: 10 }),
      rule({ categoryId: CATEGORY, minQty: 6, percentOff: 5 }),
    ];

    expect(discountLadder(rules, PRODUCT, [CATEGORY])).toEqual([{ minQty: 3, percentOff: 10 }]);
  });
});

describe('entryTier', () => {
  it('anuncia o degrau de menor quantidade', () => {
    expect(entryTier([{ minQty: 3, percentOff: 10 }, { minQty: 6, percentOff: 20 }])).toEqual({
      minQty: 3,
      percentOff: 10,
    });
  });

  it('devolve null quando o produto não tem desconto por quantidade', () => {
    expect(entryTier([])).toBeNull();
  });
});

describe('tierFor', () => {
  const LADDER = [
    { minQty: 3, percentOff: 10 },
    { minQty: 6, percentOff: 20 },
  ];

  it('devolve null antes do primeiro degrau', () => {
    expect(tierFor(LADDER, 2)).toBeNull();
  });

  it('pega o degrau alcancado', () => {
    expect(tierFor(LADDER, 3)).toEqual({ minQty: 3, percentOff: 10 });
    expect(tierFor(LADDER, 5)).toEqual({ minQty: 3, percentOff: 10 });
  });

  it('sobe para o degrau seguinte quando a quantidade o alcanca', () => {
    expect(tierFor(LADDER, 6)).toEqual({ minQty: 6, percentOff: 20 });
    expect(tierFor(LADDER, 99)).toEqual({ minQty: 6, percentOff: 20 });
  });

  it('sem escada, não há desconto', () => {
    expect(tierFor([], 10)).toBeNull();
  });
});
