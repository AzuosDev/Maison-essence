import type { FulfillmentMode } from '../../common/enums/fulfillment-mode.js';
import type { OrderStatus } from '../../common/enums/order-status.js';
import type { PaymentMethod } from '../../common/enums/payment-method.js';
import { formatBrazilianPhone } from './phone.js';
import type { OrderAddress, OrderDocument, OrderItem } from './schemas/order.schema.js';

/** Item do pedido como as telas o leem. Precos congelados, nunca recalculados. */
export interface OrderItemView {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  discountPercent: number;
  lineTotalCents: number;
}

export interface OrderAddressView {
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
}

export interface OrderFulfillmentView {
  mode: FulfillmentMode;
  cityId: string | null;
  cityName: string;
  state: string;
  estimatedDays: number;
  address: OrderAddressView | null;
}

export interface OrderPaymentView {
  method: PaymentMethod;
  installments: number;
  hasInterest: boolean;
}

export interface OrderTotalsView {
  subtotalCents: number;
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
}

export interface OrderCustomerView {
  name: string;
  /** So digitos, como esta gravado: e a chave que liga pedido e cliente. */
  phone: string;
  /** `(88) 99999-9999`. Acrescimo para a tela, nunca substituicao. */
  phoneLabel: string;
  email: string;
}

/**
 * O pedido como quem comprou o ve.
 *
 * Sem `notes`: a anotacao e conversa interna da loja — "cliente pediu para
 * entregar depois das 18h, ja atrasou duas vezes" — e sai so pelo painel.
 */
export interface CustomerOrderView {
  id: string;
  code: string;
  status: OrderStatus;
  items: OrderItemView[];
  customer: OrderCustomerView;
  fulfillment: OrderFulfillmentView;
  payment: OrderPaymentView;
  totals: OrderTotalsView;
  /** A mensagem como foi montada, para a tela oferecer copiar o texto. */
  whatsappMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

/** O mesmo pedido pelo painel, com o que so a loja pode ver. */
export interface OrderView extends CustomerOrderView {
  notes: string;
  /** Quando o cancelamento devolveu o estoque. `null` enquanto nao houve. */
  stockRestoredAt: Date | null;
}

/** A linha da listagem do painel: o que cabe numa tabela. */
export interface OrderSummaryView {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  phoneLabel: string;
  mode: FulfillmentMode;
  /**
   * Como o pagamento foi combinado.
   *
   * Entra no resumo porque e o que a dona confere antes de responder no
   * WhatsApp: um PIX pendente e uma conversa, um cartao em 6x e outra. Sem
   * ele, a tabela do painel obrigaria a abrir cada pedido para descobrir
   * qual dos dois esta na frente dela.
   */
  payment: OrderPaymentView;
  /** Quantas unidades, somando as linhas. Nao e o numero de linhas. */
  itemCount: number;
  totalCents: number;
  createdAt: Date;
}

/**
 * A resposta de `POST /orders`.
 *
 * `whatsappUrl` e o unico campo que o checkout realmente usa: e para ela que
 * o botao aponta. O pedido vai junto para a tela de confirmacao poder mostrar
 * o que foi fechado sem pedir de novo.
 */
export interface CreatedOrderView {
  orderId: string;
  code: string;
  /** Vazia quando a loja ainda nao cadastrou o numero do WhatsApp. */
  whatsappUrl: string;
  order: CustomerOrderView;
}

export function toCustomerOrderView(order: OrderDocument): CustomerOrderView {
  return {
    id: order._id.toHexString(),
    code: order.code,
    status: order.status,
    items: order.items.map(toOrderItemView),
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      phoneLabel: formatBrazilianPhone(order.customer.phone),
      email: order.customer.email,
    },
    fulfillment: {
      mode: order.fulfillment.mode,
      cityId: order.fulfillment.cityId?.toHexString() ?? null,
      cityName: order.fulfillment.cityName,
      state: order.fulfillment.state,
      estimatedDays: order.fulfillment.estimatedDays,
      address: toAddressView(order.fulfillment.address),
    },
    payment: {
      method: order.payment.method,
      installments: order.payment.installments,
      hasInterest: order.payment.hasInterest,
    },
    totals: {
      subtotalCents: order.totals.subtotalCents,
      discountTotalCents: order.totals.discountTotalCents,
      deliveryFeeCents: order.totals.deliveryFeeCents,
      pixDiscountCents: order.totals.pixDiscountCents,
      totalCents: order.totals.totalCents,
    },
    whatsappMessage: order.whatsappMessage,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toOrderView(order: OrderDocument): OrderView {
  return {
    ...toCustomerOrderView(order),
    notes: order.notes,
    stockRestoredAt: order.stockRestoredAt,
  };
}

export function toOrderSummaryView(order: OrderDocument): OrderSummaryView {
  return {
    id: order._id.toHexString(),
    code: order.code,
    status: order.status,
    customerName: order.customer.name,
    phone: order.customer.phone,
    phoneLabel: formatBrazilianPhone(order.customer.phone),
    mode: order.fulfillment.mode,
    payment: {
      method: order.payment.method,
      installments: order.payment.installments,
      hasInterest: order.payment.hasInterest,
    },
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    totalCents: order.totals.totalCents,
    createdAt: order.createdAt,
  };
}

function toOrderItemView(item: OrderItem): OrderItemView {
  return {
    productId: item.productId.toHexString(),
    variantId: item.variantId.toHexString(),
    productName: item.productName,
    variantLabel: item.variantLabel,
    image: item.image,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    discountPercent: item.discountPercent,
    lineTotalCents: item.lineTotalCents,
  };
}

function toAddressView(address: OrderAddress | null): OrderAddressView | null {
  if (address === null) {
    return null;
  }

  return {
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    zipCode: address.zipCode,
    reference: address.reference,
  };
}
