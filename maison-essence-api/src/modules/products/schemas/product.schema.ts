import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { SchemaTypes } from 'mongoose';
import {
  BaseSchema,
  EmbeddedSchema,
  baseSchemaOptions,
  embeddedSchemaOptions,
} from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  integerProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { MAX_SLUG_LENGTH, applySlugFrom } from '../../../database/slug.js';
import { Category } from '../../categories/schemas/category.schema.js';

/** Estoque maximo por variante. Serve so para barrar digitacao absurda. */
const MAX_STOCK = 1_000_000;

/**
 * Variante de um produto: o que de fato tem preco e estoque.
 *
 * Fica embutida no produto, nao em colecao propria, porque nunca e consultada
 * sozinha — toda leitura de variante acontece no contexto do produto.
 */
@Schema(embeddedSchemaOptions())
export class ProductVariant extends EmbeddedSchema {
  /** Unico dentro do produto, garantido pela validacao em `Product`. */
  @Prop(textProp({ required: true, max: 40, uppercase: true }))
  sku: string;

  /** `100ml`, `Asad Elixir`. Vazio no produto simples, de variante unica. */
  @Prop(textProp({ max: 60, default: '' }))
  label: string;

  @Prop(centsProp({ required: true }))
  priceCents: number;

  /** Preco "de", riscado no card. Quando presente, maior que `priceCents`. */
  @Prop(centsProp({ default: null }))
  compareAtPriceCents: number | null;

  @Prop(integerProp({ required: true, default: 0, max: MAX_STOCK }))
  stock: number;

  /** `publicId` do Cloudinary. Quando existe, substitui a capa do produto. */
  @Prop(textProp({ max: 200, default: '' }))
  image: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Deixa comprar com estoque zerado. Com `false`, a variante sai como esgotada. */
  @Prop({ type: Boolean, default: false })
  allowBackorder: boolean;
}

export type ProductVariantDocument = HydratedDocument<ProductVariant>;

export const ProductVariantSchema = createSchema(ProductVariant);

ProductVariantSchema.pre('validate', function () {
  // Preco riscado menor que o de venda vira desconto negativo no card.
  if (this.compareAtPriceCents != null && this.compareAtPriceCents <= this.priceCents) {
    this.invalidate(
      'compareAtPriceCents',
      'o preco de comparacao precisa ser maior que o preco de venda',
    );
  }
});

/** Produto do catalogo. Nucleo do sistema: e ele que a loja vende. */
@Schema(baseSchemaOptions({ collection: 'products' }))
export class Product extends BaseSchema {
  @Prop(textProp({ required: true, max: 160 }))
  name: string;

  @Prop(textProp({ required: true, max: MAX_SLUG_LENGTH, lowercase: true }))
  slug: string;

  @Prop(textProp({ max: 5000, default: '' }))
  description: string;

  @Prop(textProp({ max: 80, default: '' }))
  brand: string;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Category.name, default: [] })
  categoryIds: Types.ObjectId[];

  /** `publicId`s do Cloudinary na ordem de exibicao. O primeiro e a capa. */
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Destaques da home. */
  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  /** Secao "pronta entrega". */
  @Prop({ type: Boolean, default: false })
  isReadyToShip: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export type ProductDocument = HydratedDocument<Product>;

export const ProductSchema = createSchema(Product);

applySlugFrom(ProductSchema, 'name');

ProductSchema.pre('validate', function () {
  // Produto sem variante nao existe. O produto simples e um produto com uma
  // unica variante de label vazio, e a API esconde isso na leitura.
  if (this.variants.length === 0) {
    this.invalidate('variants', 'o produto precisa de ao menos uma variante');

    return;
  }

  const skus = this.variants.map((variant) => variant.sku);
  const duplicated = skus.find((sku, index) => skus.indexOf(sku) !== index);

  if (duplicated !== undefined) {
    this.invalidate('variants', `o SKU ${duplicated} aparece mais de uma vez neste produto`);
  }
});

ProductSchema.index({ slug: 1 }, { unique: true });
/**
 * Busca textual com peso maior no nome: quem procura "asad" quer o perfume
 * chamado Asad antes de todos os da marca Lattafa. `portuguese` liga o
 * stemming e a lista de stopwords da lingua, entao "velas" acha "vela".
 */
ProductSchema.index(
  { name: 'text', brand: 'text' },
  {
    name: 'product_text_search',
    weights: { name: 10, brand: 4 },
    default_language: 'portuguese',
  },
);
/** Listagem publica: ativos de uma categoria, do mais novo para o mais velho. */
ProductSchema.index({ isActive: 1, categoryIds: 1, createdAt: -1 });
