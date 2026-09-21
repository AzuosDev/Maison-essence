import { discountLadder, entryTier } from './quantity-discount.js';
import type { QuantityDiscountRule } from './quantity-discount.js';

const PRODUCT = 'p1';
const CATEGORY = 'c1';

function rule(data: Partial<QuantityDiscountRule>): QuantityDiscountRule {
  return { productId: null, categoryId: null, minQty: 3, percentOff: 10, ...data };
}

describe('discountLadder', () => {
  it('pega a regra do proprio produto', () => {
    const rules = [rule({ productId: PRODUCT, minQty: 3, percentOff: 10 })];

    expect(discountLadder(rules, PRODUCT, [])).toEqual([{ minQty: 3, percentOff: 10 }]);
  });

  it('pega a regra de uma categoria do produto', () => {
    const rules = [rule({ categoryId: CATEGORY, minQty: 2, percentOff: 5 })];

    expect(discountLadder(rules, PRODUCT, [CATEGORY])).toEqual([{ minQty: 2, percentOff: 5 }]);
  });

  it('ignora regra de outro produto e de categoria que nao e dele', () => {
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

  it('descarta degrau que nao melhora o anterior', () => {
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

  it('devolve null quando o produto nao tem desconto por quantidade', () => {
    expect(entryTier([])).toBeNull();
  });
});
