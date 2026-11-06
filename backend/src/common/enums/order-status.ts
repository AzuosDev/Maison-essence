/**
 * Ciclo de vida do pedido. Como não há gateway de pagamento, quem move o
 * status e sempre a dona pelo painel.
 *
 * ## Os valores daqui não são as palavras do painel
 *
 * A dona nomeou o ciclo em quatro passos — processando, saiu para entrega,
 * entregue, vendido —, mais o cancelamento. Os valores abaixo ficaram como
 * estavam, porque renomea-los pediria migração de pedido já fechado e nenhum
 * deles aparece em tela:
 *
 * | No painel          | Aqui              |
 * | ------------------ | ----------------- |
 * | Processando        | `PENDING_CONTACT` |
 * | Saiu para entrega  | `SHIPPED`         |
 * | Entregue           | `DELIVERED`       |
 * | Vendido            | `CONFIRMED`       |
 * | Cancelado          | `CANCELLED`       |
 *
 * `PREPARING` sobrou do ciclo antigo: nenhum pedido novo chega nele, e o
 * painel não o oferece mais. Continua aqui porque pode haver pedido gravado
 * nele, e um valor fora do enum seria recusado na leitura.
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
 * não virou conversa no WhatsApp, e metade deles nunca vira. `CANCELLED`
 * também, por motivo obvio. Os mais vendidos da vitrine e qualquer relatório
 * de faturamento leem daqui, para não divergirem um do outro.
 */
export const SOLD_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];
