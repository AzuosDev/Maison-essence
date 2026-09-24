import type { Types } from 'mongoose';
import type { CategoryDocument } from '../categories/schemas/category.schema.js';
import { discountOf, hasVariants, priceRangeOf } from './product.view.js';
import type { PriceRange } from './product.view.js';
import type { QuantityDiscountTier } from './quantity-discount.js';
import type { Product, ProductVariant } from './schemas/product.schema.js';

/**
 * Produto como ele sai do banco na leitura da vitrine: documento cru, sem
 * hidratar.
 *
 * A vitrine nunca grava, e hidratar um documento do Mongoose só para lê-lo
 * custa tempo de função serverless. O preço e não ter os virtuais: o `_id` do
 * subdocumento vem cru, e e daqui que sai o `id` da variante.
 */
export type LeanVariant = Omit<ProductVariant, 'id'> & { _id: Types.ObjectId };

export interface LeanProduct extends Omit<Product, 'id' | 'variants' | 'description'> {
  _id: Types.ObjectId;
  variants: LeanVariant[];
}

/**
 * O produto com a descrição junto.
 *
 * A listagem não traz esse campo — são até cinco mil caracteres por linha que
 * o card não exibe —, e o tipo separado e o que impede a vitrine de tentar
 * ler o que ela não pediu.
 */
export interface LeanProductFull extends LeanProduct {
  description: string;
}

/**
 * Variante como o cliente a vê.
 *
 * Não e o mesmo objeto do painel, e a diferença e o ponto: `sku` e controle
 * interno de estoque, `isActive` não existe aqui porque variante desativada
 * nem chega a ser listada, e `allowBackorder` e política de compra da dona.
 */
export interface PublicVariantView {
  id: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountPercent: number;
  /** Para o seletor de quantidade. Zero quando a venda e sob encomenda. */
  stock: number;
  isAvailable: boolean;
  /**
   * Venda sob encomenda: disponível sem estoque em mãos. E o que impede o
   * seletor de quantidade de travar em zero num produto que esta a venda.
   */
  onDemand: boolean;
  image: string;
}

/** Produto no card da vitrine. Sem descrição: o card não a exibe. */
export interface PublicProductView {
  id: string;
  name: string;
  slug: string;
  brand: string;
  images: string[];
  coverImage: string;
  variants: PublicVariantView[];
  hasVariants: boolean;
  priceRangeCents: PriceRange;
  /** O maior desconto entre as variantes a venda, para o selo do card. */
  discountPercent: number;
  inStock: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
  /** A chamada de desconto progressivo. `null` quando não há regra. */
  quantityDiscount: QuantityDiscountTier | null;
}

/** Categoria no fio de pão da página do produto. */
export interface PublicProductCategory {
  id: string;
  name: string;
  slug: string;
}

/** Produto na sua própria página: tudo do card, mais o que só ela mostra. */
export interface PublicProductDetailView extends PublicProductView {
  description: string;
  categories: PublicProductCategory[];
  /** A escada inteira, para a página mostrar quanto se ganha levando mais. */
  quantityDiscounts: QuantityDiscountTier[];
  related: PublicProductView[];
}

export function toPublicProductView(
  product: LeanProduct,
  quantityDiscount: QuantityDiscountTier | null,
): PublicProductView {
  // Variante desativada não aparece, nem entra em nenhuma conta: para o
  // cliente ela simplesmente não existe.
  const variants = product.variants.filter((variant) => variant.isActive).map(toPublicVariantView);

  return {
    id: product._id.toHexString(),
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    images: [...product.images],
    coverImage: product.images[0] ?? '',
    variants,
    hasVariants: hasVariants(variants),
    priceRangeCents: priceRangeOf(variants),
    discountPercent: Math.max(0, ...variants.map((variant) => variant.discountPercent)),
    inStock: variants.some((variant) => variant.isAvailable),
    isFeatured: product.isFeatured,
    isReadyToShip: product.isReadyToShip,
    tags: [...product.tags],
    quantityDiscount,
  };
}

export function toPublicVariantView(variant: LeanVariant): PublicVariantView {
  const onDemand = variant.allowBackorder && variant.stock <= 0;

  return {
    id: variant._id.toHexString(),
    label: variant.label,
    priceCents: variant.priceCents,
    compareAtPriceCents: variant.compareAtPriceCents,
    discountPercent: discountOf(variant.priceCents, variant.compareAtPriceCents),
    // Negativo não chega aqui pelo schema, mas o `max` deixa o contrato
    // explicito: o número que a vitrine recebe e quanto da para levar.
    stock: Math.max(0, variant.stock),
    isAvailable: variant.stock > 0 || variant.allowBackorder,
    onDemand,
    image: variant.image,
  };
}

export function toPublicCategories(
  categories: readonly CategoryDocument[],
): PublicProductCategory[] {
  return categories.map((category) => ({
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
  }));
}
