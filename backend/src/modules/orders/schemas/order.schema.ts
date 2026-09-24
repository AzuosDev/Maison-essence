import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import type { FulfillmentMode } from '../../../common/enums/fulfillment-mode.js';
import { FULFILLMENT_MODE_VALUES } from '../../../common/enums/fulfillment-mode.js';
import type { OrderStatus } from '../../../common/enums/order-status.js';
import { ORDER_STATUSES, ORDER_STATUS_VALUES } from '../../../common/enums/order-status.js';
import type { PaymentMethod } from '../../../common/enums/payment-method.js';
import { PAYMENT_METHOD_VALUES } from '../../../common/enums/payment-method.js';
import {
  BaseSchema,
  EmbeddedSchema,
  baseSchemaOptions,
  embeddedSchemaOptions,
} from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  enumProp,
  integerProp,
  objectIdProp,
  percentProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { Customer } from '../../customers/schemas/customer.schema.js';
import { generateOrderCode } from './order-code.js';

/**
 * Item do pedido, congelado no momento da compra.
 *
 * Tudo que a leitura precisa esta aqui dentro, copiado: nome do produto,
 * label da variante, imagem, preco unitario e desconto. `productId` e
 * `variantId` sao guardados sem `ref` de proposito — nao existe `populate`
 * possivel neles, e essa e a garantia de que ninguem vai, por descuido,
 * exibir o preco de hoje num pedido de tres meses atras.
 */
@Schema(embeddedSchemaOptions())
export class OrderItem extends EmbeddedSchema {
  @Prop(objectIdProp({ required: true }))
  productId: Types.ObjectId;

  @Prop(objectIdProp({ required: true }))
  variantId: Types.ObjectId;

  @Prop(textProp({ required: true, max: 160 }))
  productName: string;

  @Prop(textProp({ max: 60, default: '' }))
  variantLabel: string;

  /** `publicId` do Cloudinary, copiado na criacao do pedido. */
  @Prop(textProp({ max: 200, default: '' }))
  image: string;

  @Prop(centsProp({ required: true }))
  unitPriceCents: number;

  @Prop(integerProp({ required: true, min: 1, max: 9999 }))
  quantity: number;

  /** Desconto por quantidade aplicado a esta linha, ja resolvido. */
  @Prop(percentProp({ required: true, default: 0 }))
  discountPercent: number;

  /** `unitPriceCents * quantity` menos o desconto, calculado no servidor. */
  @Prop(centsProp({ required: true }))
  lineTotalCents: number;
}

export const OrderItemSchema = createSchema(OrderItem);

/** Endereco de entrega, copiado no momento do pedido. */
@Schema(embeddedSchemaOptions({ _id: false }))
export class OrderAddress {
  @Prop(textProp({ max: 160, default: '' }))
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
}

export const OrderAddressSchema = createSchema(OrderAddress);

/**
 * Como o pedido chega ao cliente.
 *
 * Nome, estado e taxa da cidade sao copiados: a dona pode desativar ou
 * reajustar a cidade amanha, e o pedido de hoje continua legivel com o que
 * foi combinado.
 */
@Schema(embeddedSchemaOptions({ _id: false }))
export class OrderFulfillment {
  @Prop(enumProp(FULFILLMENT_MODE_VALUES, { required: true }))
  mode: FulfillmentMode;

  /** Sem `ref`, como os itens: identifica a cidade sem convidar ao `populate`. */
  @Prop(objectIdProp({ default: null }))
  cityId: Types.ObjectId | null;

  @Prop(textProp({ max: 120, default: '' }))
  cityName: string;

  @Prop(textProp({ max: 2, uppercase: true, default: '' }))
  state: string;

  @Prop(integerProp({ default: 0, max: 90 }))
  estimatedDays: number;

  @Prop({ type: OrderAddressSchema, default: null })
  address: OrderAddress | null;
}

export const OrderFulfillmentSchema = createSchema(OrderFulfillment);

/** Forma de pagamento escolhida. Nada e cobrado pelo sistema. */
@Schema(embeddedSchemaOptions({ _id: false }))
export class OrderPayment {
  @Prop(enumProp(PAYMENT_METHOD_VALUES, { required: true }))
  method: PaymentMethod;

  @Prop(integerProp({ required: true, default: 1, min: 1, max: 24 }))
  installments: number;

  @Prop({ type: Boolean, default: false })
  hasInterest: boolean;
}

export const OrderPaymentSchema = createSchema(OrderPayment);

/** Totais do pedido, todos em centavos e todos calculados no servidor. */
@Schema(embeddedSchemaOptions({ _id: false }))
export class OrderTotals {
  @Prop(centsProp({ required: true }))
  subtotalCents: number;

  @Prop(centsProp({ required: true, default: 0 }))
  discountTotalCents: number;

  @Prop(centsProp({ required: true, default: 0 }))
  deliveryFeeCents: number;

  @Prop(centsProp({ required: true, default: 0 }))
  pixDiscountCents: number;

  @Prop(centsProp({ required: true }))
  totalCents: number;
}

export const OrderTotalsSchema = createSchema(OrderTotals);

/** Dados de contato de quem comprou. O checkout como convidado e o padrao. */
@Schema(embeddedSchemaOptions({ _id: false }))
export class OrderCustomer {
  @Prop(textProp({ required: true, max: 120 }))
  name: string;

  /** Celular brasileiro com DDD, so digitos. E a chave que liga pedido e cliente. */
  @Prop(
    textProp({
      required: true,
      max: 13,
      match: [/^\d{10,13}$/, 'o telefone deve ter só digitos, com DDD'],
    }),
  )
  phone: string;

  @Prop(textProp({ max: 160, default: '', lowercase: true }))
  email: string;
}

export const OrderCustomerSchema = createSchema(OrderCustomer);

/** Pedido. Documento imutavel em tudo que diz respeito a precos. */
@Schema(baseSchemaOptions({ collection: 'orders' }))
export class Order extends BaseSchema {
  /** `ME-AAMMDD-XXXX`. Gerado no `pre('validate')` quando nao vem preenchido. */
  @Prop(textProp({ required: true, max: 20, uppercase: true }))
  code: string;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ type: OrderCustomerSchema, required: true })
  customer: OrderCustomer;

  @Prop({ type: OrderFulfillmentSchema, required: true })
  fulfillment: OrderFulfillment;

  @Prop({ type: OrderPaymentSchema, required: true })
  payment: OrderPayment;

  @Prop({ type: OrderTotalsSchema, required: true })
  totals: OrderTotals;

  @Prop(enumProp(ORDER_STATUS_VALUES, { required: true, default: ORDER_STATUSES.PENDING_CONTACT }))
  status: OrderStatus;

  /** Mensagem montada no servidor e guardada como foi enviada. */
  @Prop(textProp({ max: 6000, default: '' }))
  whatsappMessage: string;

  /** Anotacao interna da dona. Nunca sai em rota publica. */
  @Prop(textProp({ max: 2000, default: '' }))
  notes: string;

  /**
   * Cliente com conta, quando houver. Aqui o `ref` e legitimo: e vinculo
   * vivo, nao preco congelado — o cliente pode se cadastrar depois com o
   * mesmo telefone e receber os pedidos antigos.
   */
  @Prop(objectIdProp({ ref: Customer.name, default: null }))
  customerId: Types.ObjectId | null;

  /** Marcado no cancelamento, para o estoque nao ser devolvido duas vezes. */
  @Prop({ type: Date, default: null })
  stockRestoredAt: Date | null;
}

export type OrderDocument = HydratedDocument<Order>;

export const OrderSchema = createSchema(Order);

OrderSchema.pre('validate', function () {
  if (typeof this.code !== 'string' || this.code.length === 0) {
    this.code = generateOrderCode();
  }
});

OrderSchema.index({ code: 1 }, { unique: true });
// Painel: pedidos de um status, do mais recente para o mais antigo.
OrderSchema.index({ status: 1, createdAt: -1 });
// Historico de um cliente, com ou sem conta — o telefone e a chave natural.
OrderSchema.index({ 'customer.phone': 1, createdAt: -1 });
/**
 * "Esta variante ja foi vendida?" — a pergunta que o modulo de produtos faz
 * antes de apagar uma variante que saiu da lista, e antes de excluir um
 * produto. Sem o indice, cada gravacao no painel varreria os pedidos.
 */
OrderSchema.index({ 'items.variantId': 1 });
