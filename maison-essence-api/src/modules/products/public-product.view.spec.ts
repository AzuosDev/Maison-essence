import { Types } from 'mongoose';
import { toPublicProductView, toPublicVariantView } from './public-product.view.js';
import type { LeanProduct, LeanVariant } from './public-product.view.js';

function variant(overrides: Partial<LeanVariant> = {}): LeanVariant {
  return {
    _id: new Types.ObjectId(),
    sku: 'ASAD-100',
    label: '100 ml',
    priceCents: 19_990,
    compareAtPriceCents: null,
    stock: 3,
    image: '',
    isActive: true,
    allowBackorder: false,
    ...overrides,
  };
}

function product(overrides: Partial<LeanProduct> = {}): LeanProduct {
  return {
    _id: new Types.ObjectId(),
    name: 'Asad Lattafa',
    slug: 'asad-lattafa',
    brand: 'Lattafa',
    categoryIds: [],
    images: ['maison-essence/products/asad-9f3a1c2b'],
    variants: [variant()],
    isActive: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('toPublicVariantView', () => {
  /**
   * O que a vitrine nao recebe e tao importante quanto o que ela recebe: o
   * SKU e controle de estoque da dona e nao tem por que trafegar na loja
   * aberta, e `allowBackorder` e a politica de compra dela com o
   * distribuidor.
   */
  it('nao entrega sku, isActive nem a politica de encomenda', () => {
    const view = toPublicVariantView(variant()) as unknown as Record<string, unknown>;

    expect(view.sku).toBeUndefined();
    expect(view.isActive).toBeUndefined();
    expect(view.allowBackorder).toBeUndefined();
  });

  it('marca como sob encomenda a variante sem estoque que continua a venda', () => {
    const view = toPublicVariantView(variant({ stock: 0, allowBackorder: true }));

    expect(view.onDemand).toBe(true);
    expect(view.isAvailable).toBe(true);
    expect(view.stock).toBe(0);
  });

  it('nao vende variante esgotada que nao aceita encomenda', () => {
    expect(toPublicVariantView(variant({ stock: 0 })).isAvailable).toBe(false);
  });

  it('calcula o desconto da etiqueta', () => {
    expect(
      toPublicVariantView(variant({ priceCents: 19_990, compareAtPriceCents: 29_990 }))
        .discountPercent,
    ).toBe(33);
  });
});

describe('toPublicProductView', () => {
  it('esconde a variante desativada e todas as contas dela', () => {
    const view = toPublicProductView(
      product({
        variants: [
          variant({ label: '100 ml', priceCents: 19_990 }),
          variant({ label: '50 ml', priceCents: 4990, isActive: false }),
        ],
      }),
      null,
    );

    expect(view.variants).toHaveLength(1);
    // Sem o filtro, a vitrine anunciaria "a partir de R$ 49,90" num frasco
    // que a dona tirou de linha.
    expect(view.priceRangeCents).toEqual({ min: 19_990, max: 19_990 });
  });

  it('vira produto simples quando so sobra uma variante sem label', () => {
    const view = toPublicProductView(
      product({
        variants: [variant({ label: '' }), variant({ label: '50 ml', isActive: false })],
      }),
      null,
    );

    expect(view.hasVariants).toBe(false);
  });

  it('nao esta em estoque quando nenhuma variante a venda esta', () => {
    const view = toPublicProductView(product({ variants: [variant({ stock: 0 })] }), null);

    expect(view.inStock).toBe(false);
  });

  it('exibe o maior desconto entre as variantes a venda', () => {
    const view = toPublicProductView(
      product({
        variants: [
          variant({ priceCents: 19_990, compareAtPriceCents: 21_990 }),
          variant({ priceCents: 9990, compareAtPriceCents: 19_990 }),
        ],
      }),
      null,
    );

    expect(view.discountPercent).toBe(50);
  });

  it('carrega a chamada de desconto progressivo que receber', () => {
    const view = toPublicProductView(product(), { minQty: 3, percentOff: 10 });

    expect(view.quantityDiscount).toEqual({ minQty: 3, percentOff: 10 });
  });

  it('nao entrega campos de gestao da loja', () => {
    const view = toPublicProductView(product(), null) as unknown as Record<string, unknown>;

    expect(view.isActive).toBeUndefined();
    expect(view.totalStock).toBeUndefined();
    expect(view.updatedAt).toBeUndefined();
  });
});
