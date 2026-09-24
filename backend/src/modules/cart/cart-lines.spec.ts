import type { QuantityDiscountRule } from '../products/quantity-discount.js';
import { itemWarnings, lineTotalsOf, mergeLines, quoteItems, sumItems } from './cart-lines.js';
import type { CatalogProduct, CatalogVariant, RequestedLine } from './cart-lines.js';
import {
  MAX_LINE_QUANTITY,
  PRODUCT_UNAVAILABLE_REASON,
  VARIANT_UNAVAILABLE_REASON,
} from './cart.constants.js';

function variant(data: Partial<CatalogVariant> = {}): CatalogVariant {
  return {
    id: 'v1',
    label: '100 ml',
    priceCents: 10_000,
    stock: 10,
    image: '',
    isActive: true,
    allowBackorder: false,
    ...data,
  };
}

function product(data: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'p1',
    name: 'Asad',
    slug: 'asad',
    coverImage: 'capa',
    isActive: true,
    categoryIds: [],
    variants: [variant()],
    ...data,
  };
}

function line(data: Partial<RequestedLine> = {}): RequestedLine {
  return { productId: 'p1', variantId: 'v1', quantity: 1, ...data };
}

function rule(data: Partial<QuantityDiscountRule>): QuantityDiscountRule {
  return { productId: null, categoryId: null, minQty: 3, percentOff: 10, ...data };
}

describe('mergeLines', () => {
  it('soma as linhas da mesma variante', () => {
    const { lines } = mergeLines([line({ quantity: 2 }), line({ quantity: 3 })]);

    expect(lines).toEqual([line({ quantity: 5 })]);
  });

  it('avisa que juntou linhas repetidas', () => {
    const { warnings } = mergeLines([line(), line()]);

    expect(warnings).toHaveLength(1);
  });

  it('não junta variantes diferentes do mesmo produto', () => {
    const { lines, warnings } = mergeLines([line(), line({ variantId: 'v2' })]);

    expect(lines).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it('limita a soma ao teto por item, avisando', () => {
    const { lines, warnings } = mergeLines([
      line({ quantity: MAX_LINE_QUANTITY }),
      line({ quantity: 10 }),
    ]);

    expect(lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
    expect(warnings).toHaveLength(2);
  });
});

describe('quoteItems', () => {
  it('usa o preço do catalogo, não o que veio na linha', () => {
    // A linha nao tem onde carregar um preco: o tipo so aceita ids e
    // quantidade, e o valor sai da variante.
    const [item] = quoteItems([line({ quantity: 2 })], [product()], []);

    expect(item?.unitPriceCents).toBe(10_000);
    expect(item?.lineTotalCents).toBe(20_000);
  });

  it('copia nome, variante e imagem do catalogo', () => {
    const [item] = quoteItems([line()], [product()], []);

    expect(item?.productName).toBe('Asad');
    expect(item?.variantLabel).toBe('100 ml');
    expect(item?.image).toBe('capa');
  });

  it('prefere a foto da variante a capa do produto', () => {
    const withImage = product({ variants: [variant({ image: 'frasco' })] });

    expect(quoteItems([line()], [withImage], [])[0]?.image).toBe('frasco');
  });

  it('recusa a linha de produto que não esta no catalogo', () => {
    const [item] = quoteItems([line({ productId: 'sumiu' })], [], []);

    expect(item?.unavailable).toBe(true);
    expect(item?.unavailableReason).toBe(PRODUCT_UNAVAILABLE_REASON);
    expect(item?.lineTotalCents).toBe(0);
  });

  it('recusa a linha de produto desativado', () => {
    const [item] = quoteItems([line()], [product({ isActive: false })], []);

    expect(item?.unavailableReason).toBe(PRODUCT_UNAVAILABLE_REASON);
  });

  it('recusa a linha de variante desativada', () => {
    const off = product({ variants: [variant({ isActive: false })] });

    expect(quoteItems([line()], [off], [])[0]?.unavailableReason).toBe(VARIANT_UNAVAILABLE_REASON);
  });

  it('recusa a linha sem estoque e diz quanto sobrou', () => {
    const last = product({ variants: [variant({ stock: 2 })] });
    const [item] = quoteItems([line({ quantity: 3 })], [last], []);

    expect(item?.unavailable).toBe(true);
    expect(item?.availableStock).toBe(2);
    expect(item?.lineTotalCents).toBe(0);
  });

  it('aceita a venda sob encomenda mesmo sem estoque', () => {
    const onDemand = product({ variants: [variant({ stock: 0, allowBackorder: true })] });
    const [item] = quoteItems([line({ quantity: 3 })], [onDemand], []);

    expect(item?.unavailable).toBe(false);
    expect(item?.lineTotalCents).toBe(30_000);
  });

  it('aplica o desconto por quantidade do produto', () => {
    const rules = [rule({ productId: 'p1', minQty: 3, percentOff: 10 })];
    const [item] = quoteItems([line({ quantity: 3 })], [product()], rules);

    expect(item?.discountPercent).toBe(10);
    expect(item?.discountCents).toBe(3_000);
    expect(item?.lineTotalCents).toBe(27_000);
  });

  it('não aplica desconto abaixo do degrau', () => {
    const rules = [rule({ productId: 'p1', minQty: 3, percentOff: 10 })];

    expect(quoteItems([line({ quantity: 2 })], [product()], rules)[0]?.discountPercent).toBe(0);
  });

  it('usa o maior desconto aplicável, sem somar produto e categoria', () => {
    const rules = [
      rule({ productId: 'p1', minQty: 3, percentOff: 10 }),
      rule({ categoryId: 'c1', minQty: 3, percentOff: 15 }),
    ];
    const [item] = quoteItems(
      [line({ quantity: 3 })],
      [product({ categoryIds: ['c1'] })],
      rules,
    );

    expect(item?.discountPercent).toBe(15);
    expect(item?.lineTotalCents).toBe(25_500);
  });

  it('soma as variantes do mesmo produto para decidir o degrau', () => {
    const duas = product({ variants: [variant(), variant({ id: 'v2', priceCents: 6_000 })] });
    const rules = [rule({ productId: 'p1', minQty: 3, percentOff: 10 })];
    const items = quoteItems(
      [line({ quantity: 2 }), line({ variantId: 'v2', quantity: 1 })],
      [duas],
      rules,
    );

    expect(items.map((item) => item.discountPercent)).toEqual([10, 10]);
  });

  it('a linha recusada não empurra as outras para o degrau seguinte', () => {
    const duas = product({
      variants: [variant(), variant({ id: 'v2', stock: 0 })],
    });
    const rules = [rule({ productId: 'p1', minQty: 3, percentOff: 10 })];
    const items = quoteItems(
      [line({ quantity: 2 }), line({ variantId: 'v2', quantity: 5 })],
      [duas],
      rules,
    );

    expect(items[0]?.discountPercent).toBe(0);
    expect(items[1]?.unavailable).toBe(true);
  });
});

describe('lineTotalsOf', () => {
  it('arredonda o centavo a favor de quem paga', () => {
    // 10% de R$ 19,99 sao R$ 1,999 — o desconto vira R$ 2,00.
    expect(lineTotalsOf(1_999, 1, 10)).toEqual({ discountCents: 200, lineTotalCents: 1_799 });
  });

  it('sem desconto, e preço vezes quantidade', () => {
    expect(lineTotalsOf(1_999, 3, 0)).toEqual({ discountCents: 0, lineTotalCents: 5_997 });
  });
});

describe('sumItems', () => {
  it('soma só o que esta disponível', () => {
    const esgotado = product({ id: 'p2', variants: [variant({ id: 'v9', stock: 0 })] });
    const items = quoteItems(
      [line({ quantity: 2 }), line({ productId: 'p2', variantId: 'v9', quantity: 1 })],
      [product(), esgotado],
      [],
    );

    expect(sumItems(items)).toEqual({ subtotalCents: 20_000, discountTotalCents: 0 });
    expect(itemWarnings(items)).toHaveLength(1);
  });

  it('sacola vazia soma zero', () => {
    expect(sumItems([])).toEqual({ subtotalCents: 0, discountTotalCents: 0 });
  });
});
