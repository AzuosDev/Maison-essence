import type { ProductDocument, ProductVariant } from './schemas/product.schema.js';

/** O mínimo para decidir se o produto tem variantes: a vitrine lê lean, sem `id`. */
type LabelledVariant = Pick<ProductVariant, 'label'>;

/** O mínimo para a faixa de preço, pelo mesmo motivo. */
type PricedVariant = Pick<ProductVariant, 'priceCents'>;

/** Variante como o painel a vê. */
export interface ProductVariantView {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  /** Desconto desta variante. Zero quando não há preço de comparação. */
  discountPercent: number;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
  /** O que decide entre "comprar" e "esgotado" no card. */
  isAvailable: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface ProductView {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryIds: string[];
  /** `publicId`s do Cloudinary na ordem de exibição. */
  images: string[];
  /** A primeira imagem. A da variante, quando existe, a substitui na seleção. */
  coverImage: string;
  variants: ProductVariantView[];
  /**
   * `false` no produto simples — variante única e sem label. E o que permite
   * a tela esconder a seção de variantes em vez de mostrar uma linha vazia.
   */
  hasVariants: boolean;
  priceRangeCents: PriceRange;
  discountPercent: number;
  inStock: boolean;
  totalStock: number;
  isActive: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toProductView(product: ProductDocument): ProductView {
  const variants = product.variants.map(toVariantView);
  // Os cálculos do card descrevem o que esta a venda, e não o que a dona
  // deixou guardado no cadastro: variante desativada não entra em nenhum.
  const active = variants.filter((variant) => variant.isActive);

  return {
    id: product._id.toHexString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    categoryIds: product.categoryIds.map((id) => id.toHexString()),
    images: [...product.images],
    coverImage: product.images[0] ?? '',
    variants,
    hasVariants: hasVariants(product.variants),
    priceRangeCents: priceRangeOf(active.length > 0 ? active : variants),
    discountPercent: Math.max(0, ...active.map((variant) => variant.discountPercent)),
    inStock: active.some((variant) => variant.isAvailable),
    totalStock: active.reduce((total, variant) => total + variant.stock, 0),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isReadyToShip: product.isReadyToShip,
    tags: [...product.tags],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function toVariantView(variant: ProductVariant): ProductVariantView {
  const stock = variant.stock;

  return {
    // `id` e o virtual do subdocumento: a variante tem identidade própria, e
    // e por ela que o PATCH casa a lista recebida com a que esta gravada.
    id: variant.id,
    sku: variant.sku,
    label: variant.label,
    priceCents: variant.priceCents,
    compareAtPriceCents: variant.compareAtPriceCents,
    discountPercent: discountOf(variant.priceCents, variant.compareAtPriceCents),
    stock,
    image: variant.image,
    isActive: variant.isActive,
    allowBackorder: variant.allowBackorder,
    // Com `allowBackorder`, estoque zero não impede a venda: a dona encomenda
    // ao distribuidor depois do pedido, que e como metade do catálogo gira.
    isAvailable: variant.isActive && (stock > 0 || variant.allowBackorder),
  };
}

/**
 * Produto simples e o que tem exatamente uma variante sem label. Qualquer
 * outra coisa — duas variantes, ou uma só mas chamada de "100 ml" — e um
 * produto com variantes, e a tela mostra o seletor.
 */
export function hasVariants(variants: readonly LabelledVariant[]): boolean {
  return variants.length > 1 || (variants[0]?.label ?? '') !== '';
}

/**
 * Menor e maior preço. Sem variante ativa, cai para a lista inteira: o painel
 * mostrando "R$ 0,00" num produto só desativado parece defeito, não estado.
 */
export function priceRangeOf(variants: readonly PricedVariant[]): PriceRange {
  const prices = variants.map((variant) => variant.priceCents);

  return prices.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Desconto em pontos percentuais inteiros, sempre para baixo.
 *
 * `Math.floor` e não `Math.round` de propósito: anunciar 20% quando o
 * desconto real e 19,6% e propaganda enganosa, e o troco da conta não vale o
 * risco. Para baixo, o cliente sempre paga menos do que a etiqueta promete.
 */
export function discountOf(priceCents: number, compareAtPriceCents: number | null): number {
  if (compareAtPriceCents == null || compareAtPriceCents <= priceCents) {
    return 0;
  }

  return Math.floor(((compareAtPriceCents - priceCents) / compareAtPriceCents) * 100);
}
