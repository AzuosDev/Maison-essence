/** Como o pedido chega ao cliente: entrega na cidade ou retirada na loja. */
export const FULFILLMENT_MODES = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
} as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[keyof typeof FULFILLMENT_MODES];

export const FULFILLMENT_MODE_VALUES: readonly FulfillmentMode[] =
  Object.values(FULFILLMENT_MODES);
