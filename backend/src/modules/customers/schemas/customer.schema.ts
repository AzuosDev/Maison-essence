import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import {
  BaseSchema,
  EmbeddedSchema,
  baseSchemaOptions,
  embeddedSchemaOptions,
} from '../../../database/base.schema.js';
import {
  createSchema,
  integerProp,
  objectIdProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { DeliveryCity } from '../../delivery/schemas/delivery-city.schema.js';

/**
 * Endereco salvo na conta do cliente.
 *
 * Aqui o `ref` para a cidade e proposital, ao contrario do endereco do
 * pedido: este e o endereco vivo, que deve refletir a taxa de hoje na proxima
 * compra. O pedido guarda a copia.
 */
@Schema(embeddedSchemaOptions())
export class CustomerAddress extends EmbeddedSchema {
  /** "Casa", "Trabalho". */
  @Prop(textProp({ max: 40, default: '' }))
  label: string;

  @Prop(objectIdProp({ ref: DeliveryCity.name, default: null }))
  cityId: Types.ObjectId | null;

  @Prop(textProp({ required: true, max: 160 }))
  street: string;

  @Prop(textProp({ max: 20, default: '' }))
  number: string;

  @Prop(textProp({ max: 80, default: '' }))
  complement: string;

  @Prop(textProp({ max: 80, default: '' }))
  district: string;

  @Prop(textProp({ max: 9, default: '' }))
  zipCode: string;

  @Prop(textProp({ max: 200, default: '' }))
  reference: string;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;
}

export const CustomerAddressSchema = createSchema(CustomerAddress);

/**
 * Conta de cliente, sempre opcional.
 *
 * O checkout como convidado continua sendo o caminho padrao: esta colecao so
 * existe para quem quiser acompanhar os proprios pedidos. Nada aqui da acesso
 * ao painel — o token do cliente tem audience propria.
 */
@Schema(baseSchemaOptions({ collection: 'customers' }))
export class Customer extends BaseSchema {
  @Prop(textProp({ required: true, max: 120 }))
  name: string;

  /** Chave natural: e o telefone que liga o pedido feito como convidado a conta. */
  @Prop(
    textProp({
      required: true,
      max: 13,
      match: [/^\d{10,13}$/, 'o telefone deve ter so digitos, com DDD'],
    }),
  )
  phone: string;

  @Prop(textProp({ max: 160, default: '', lowercase: true }))
  email: string;

  @Prop(textProp({ required: true, max: 255, select: false }))
  passwordHash: string;

  @Prop({ type: [CustomerAddressSchema], default: [] })
  addresses: CustomerAddress[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /**
   * Contador de credencial, como no usuario do painel.
   *
   * Viaja dentro do access token e e conferido a cada request: incrementar
   * aqui invalida na hora todos os tokens ja emitidos para a conta, sem
   * esperar os trinta minutos de validade. E o que faz "trocar a senha
   * derruba os outros aparelhos" significar alguma coisa.
   */
  @Prop(integerProp({ required: true, default: 0, min: 0 }))
  credentialVersion: number;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;
}

export type CustomerDocument = HydratedDocument<Customer>;

export const CustomerSchema = createSchema(Customer);

CustomerSchema.index({ phone: 1 }, { unique: true });
// Indice parcial, e nao `sparse`: o e-mail e opcional e tem default `''`, e
// `sparse` so ignora o campo ausente — todos os clientes sem e-mail entrariam
// no indice com a mesma string vazia e colidiriam entre si.
CustomerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: '' } } },
);
