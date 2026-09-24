import { discountOf, hasVariants, toVariantView } from './product.view.js';
import type { ProductVariant } from './schemas/product.schema.js';

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: '64b7f1c2a1b2c3d4e5f60001',
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

describe('discountOf', () => {
  it('calcula o desconto em pontos percentuais', () => {
    expect(discountOf(19_990, 29_990)).toBe(33);
  });

  it('arredonda para baixo, para nunca anunciar desconto maior que o real', () => {
    // 19,6% viraria 20% com arredondamento comum.
    expect(discountOf(8040, 10_000)).toBe(19);
  });

  it('e zero sem preço de comparação ou com preço de comparação menor', () => {
    expect(discountOf(19_990, null)).toBe(0);
    expect(discountOf(19_990, 9990)).toBe(0);
  });
});

describe('hasVariants', () => {
  it('e falso no produto simples: variante única e sem label', () => {
    expect(hasVariants([variant({ label: '' })])).toBe(false);
  });

  it('e verdadeiro com mais de uma variante', () => {
    expect(hasVariants([variant({ label: '' }), variant({ label: '' })])).toBe(true);
  });

  it('e verdadeiro com uma variante que tem label', () => {
    expect(hasVariants([variant({ label: '100 ml' })])).toBe(true);
  });
});

describe('toVariantView', () => {
  it('marca como indisponível a variante sem estoque', () => {
    expect(toVariantView(variant({ stock: 0 })).isAvailable).toBe(false);
  });

  it('mantem disponível a variante sem estoque que aceita encomenda', () => {
    expect(toVariantView(variant({ stock: 0, allowBackorder: true })).isAvailable).toBe(true);
  });

  it('não vende variante desativada, nem com estoque', () => {
    expect(toVariantView(variant({ isActive: false, stock: 10 })).isAvailable).toBe(false);
  });
});
