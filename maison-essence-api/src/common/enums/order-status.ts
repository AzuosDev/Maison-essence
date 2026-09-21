/**
 * Ciclo de vida do pedido. Como nao ha gateway de pagamento, quem move o
 * status e sempre a dona pelo painel.
 */
export const ORDER_STATUSES = {
  PENDING_CONTACT: 'PENDING_CONTACT',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = Object.values(ORDER_STATUSES);

/**
 * Os status que contam como venda fechada.
 *
 * `PENDING_CONTACT` fica de fora: e o pedido que o cliente montou e ainda
 * nao virou conversa no WhatsApp, e metade deles nunca vira. `CANCELLED`
 * tambem, por motivo obvio. Os mais vendidos da vitrine e qualquer relatorio
 * de faturamento leem daqui, para nao divergirem um do outro.
 */
export const SOLD_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];
