import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  integerProp,
  textProp,
} from '../../../database/schema-helpers.js';

/**
 * Cidade atendida, com taxa fixa. Não há cálculo por CEP nem integração com
 * os Correios: a dona cadastra as cidades para onde entrega e o valor de cada
 * uma.
 */
@Schema(baseSchemaOptions({ collection: 'delivery_cities' }))
export class DeliveryCity extends BaseSchema {
  @Prop(textProp({ required: true, max: 120 }))
  name: string;

  /** Sigla do estado, duas letras. */
  @Prop(
    textProp({
      required: true,
      max: 2,
      uppercase: true,
      match: [/^[A-Z]{2}$/, 'o estado deve ser a sigla de duas letras, como CE'],
    }),
  )
  state: string;

  @Prop(centsProp({ required: true, default: 0 }))
  feeCents: number;

  /** Prazo em dias para a entrega, exibido junto da taxa. */
  @Prop(integerProp({ required: true, default: 1, max: 90 }))
  estimatedDays: number;

  /**
   * Valor de pedido a partir do qual a entrega nesta cidade sai de graça.
   * `null` significa "sem regra própria" — cai na regra global da loja, que
   * esta em `StoreSettings`.
   */
  @Prop(centsProp({ default: null }))
  minOrderForFreeCents: number | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop(integerProp({ default: 0, max: 9999 }))
  order: number;
}

export type DeliveryCityDocument = HydratedDocument<DeliveryCity>;

export const DeliveryCitySchema = createSchema(DeliveryCity);

// Lista publica: só as ativas, na ordem escolhida pela dona.
DeliveryCitySchema.index({ isActive: 1, order: 1 });
// A mesma cidade cadastrada duas vezes viraria duas taxas diferentes para o
// mesmo endereço.
DeliveryCitySchema.index({ name: 1, state: 1 }, { unique: true });
