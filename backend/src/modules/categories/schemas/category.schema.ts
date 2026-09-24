import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  createSchema,
  integerProp,
  objectIdProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { MAX_SLUG_LENGTH, applySlugFrom } from '../../../database/slug.js';
import { MAX_CATEGORY_ORDER } from '../categories.constants.js';

/** Categoria do catálogo. Aceita um único nível de subcategoria, via `parentId`. */
@Schema(baseSchemaOptions({ collection: 'categories' }))
export class Category extends BaseSchema {
  @Prop(textProp({ required: true, max: 80 }))
  name: string;

  @Prop(textProp({ required: true, max: MAX_SLUG_LENGTH, lowercase: true }))
  slug: string;

  /**
   * Slugs que esta categoria já teve. Permite responder o link antigo com um
   * redirecionamento em vez de 404 — o endereço anterior continua circulando
   * no WhatsApp depois que a dona renomeia a categoria.
   */
  @Prop({ type: [String], default: [] })
  previousSlugs: string[];

  /**
   * Categoria pai. Literal `'Category'` em vez de `Category.name` porque a
   * classe ainda esta sendo criada quando o decorator avalia.
   */
  @Prop(objectIdProp({ ref: 'Category', default: null }))
  parentId: Types.ObjectId | null;

  /** `publicId` do Cloudinary, não a URL: trocar de conta ou de transformação
   * depois não exige migrar dado nenhum. */
  @Prop(textProp({ max: 200, default: '' }))
  image: string;

  /** Posição no menu. A rota de reorder regrava a lista inteira. */
  @Prop(integerProp({ default: 0, max: MAX_CATEGORY_ORDER }))
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type CategoryDocument = HydratedDocument<Category>;

export const CategorySchema = createSchema(Category);

applySlugFrom(CategorySchema, 'name');

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ previousSlugs: 1 });
// Monta a árvore do menu: filhos de um pai, já na ordem certa.
CategorySchema.index({ parentId: 1, order: 1 });
