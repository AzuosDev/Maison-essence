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
