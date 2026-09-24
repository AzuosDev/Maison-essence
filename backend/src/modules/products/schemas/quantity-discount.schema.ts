import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  createSchema,
  integerProp,
  objectIdProp,
  percentProp,
} from '../../../database/schema-helpers.js';
import { Category } from '../../categories/schemas/category.schema.js';
import { Product } from './product.schema.js';

/**
 * Desconto progressivo por quantidade: "leve 3, ganhe 10%".
 *
 * A regra aponta para um produto ou para uma categoria, nunca para os dois.
 * Quando mais de uma regra se aplica ao mesmo item, vence a de maior desconto
 * — elas nunca se somam.
 */
@Schema(baseSchemaOptions({ collection: 'quantity_discounts' }))
export class QuantityDiscount extends BaseSchema {
  @Prop(objectIdProp({ ref: Product.name, default: null }))
  productId: Types.ObjectId | null;

  @Prop(objectIdProp({ ref: Category.name, default: null }))
  categoryId: Types.ObjectId | null;

  /** A partir de quantas unidades a regra vale. Menos de duas não e "por quantidade". */
  @Prop(integerProp({ required: true, min: 2, max: 1000 }))
  minQty: number;

  @Prop(percentProp({ required: true, min: 1, max: 90 }))
  percentOff: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type QuantityDiscountDocument = HydratedDocument<QuantityDiscount>;

export const QuantityDiscountSchema = createSchema(QuantityDiscount);

QuantityDiscountSchema.pre('validate', function () {
  const targets = [this.productId, this.categoryId].filter((target) => target != null);

  if (targets.length !== 1) {
    this.invalidate(
      'productId',
      'informe productId ou categoryId, exatamente um dos dois',
    );
  }
});

// Buscar as regras que valem para um item da cotação.
QuantityDiscountSchema.index({ productId: 1, minQty: 1 });
QuantityDiscountSchema.index({ categoryId: 1, minQty: 1 });
