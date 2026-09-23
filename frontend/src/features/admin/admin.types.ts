/**
 * O painel como a API o entrega.
 *
 * Espelho das views administrativas do backend, escrito a mao porque as duas
 * pastas sao projetos separados. A diferenca para os tipos da loja nao e
 * cosmetica: aqui aparecem `sku`, `isActive`, `stock` real e as anotacoes
 * internas do pedido — tudo o que a vitrine nunca ve.
 *
 * As datas chegam como texto ISO. Nao sao convertidas para `Date` na
 * fronteira de proposito: o que a tela faz com elas e formatar e comparar, e
 * as duas coisas funcionam no texto ordenavel que o JSON ja traz.
 */

/* ---- Paginacao ---------------------------------------------------------- */

export interface AdminPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

/** O teto que `MAX_PAGE_SIZE` impoe nas listagens administrativas. */
export const ADMIN_MAX_PAGE_SIZE = 100;

/** O tamanho de pagina das tabelas do painel. */
export const ADMIN_PAGE_SIZE = 20;

/* ---- Pedidos ------------------------------------------------------------ */

export const ORDER_STATUSES = {
  PENDING_CONTACT: 'PENDING_CONTACT',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/**
 * Os status que contam como venda fechada.
 *
 * Copia fiel de `SOLD_ORDER_STATUSES` no backend, e a fidelidade e o ponto:
 * o faturamento que o painel mostra precisa ser o mesmo numero que qualquer
 * relatorio do servidor daria. `PENDING_CONTACT` fica de fora porque metade
 * desses pedidos nunca vira conversa; `CANCELLED`, por motivo obvio.
 */
export const SOLD_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];

export const FULFILLMENT_MODES = { DELIVERY: 'DELIVERY', PICKUP: 'PICKUP' } as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[keyof typeof FULFILLMENT_MODES];

export const PAYMENT_METHODS = { PIX: 'PIX', CARD: 'CARD' } as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/** A linha da tabela de pedidos. */
export interface AdminOrderSummary {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  /** So digitos: e com ele que se monta o link da conversa. */
  phone: string;
  /** `(88) 99999-9999`, pronto pela API. */
  phoneLabel: string;
  mode: FulfillmentMode;
  /**
   * Como o pagamento foi combinado.
   *
   * No resumo, e nao so no detalhe: e a coluna que a dona le antes de abrir
   * a conversa. Um PIX pendente pede uma frase, um cartao em 6x pede outra.
   */
  payment: AdminOrderPayment;
  /** Unidades somadas, e nao o numero de linhas. */
  itemCount: number;
  totalCents: number;
  createdAt: string;
}

export interface AdminOrderItem {
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

export interface AdminOrderAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
}

export interface AdminOrderFulfillment {
  mode: FulfillmentMode;
  cityId: string | null;
  cityName: string;
  state: string;
  estimatedDays: number;
  /** `null` na retirada: nao ha endereco a preencher. */
  address: AdminOrderAddress | null;
}

export interface AdminOrderPayment {
  method: PaymentMethod;
  installments: number;
  hasInterest: boolean;
}

export interface AdminOrderTotals {
  subtotalCents: number;
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
}

export interface AdminOrderCustomer {
  name: string;
  phone: string;
  phoneLabel: string;
  email: string;
}

/** O pedido inteiro, como so o painel o ve. */
export interface AdminOrder {
  id: string;
  code: string;
  status: OrderStatus;
  items: AdminOrderItem[];
  customer: AdminOrderCustomer;
  fulfillment: AdminOrderFulfillment;
  payment: AdminOrderPayment;
  totals: AdminOrderTotals;
  /** A mensagem como foi montada e enviada ao WhatsApp. */
  whatsappMessage: string;
  /** Conversa interna da loja. Nunca sai para o cliente. */
  notes: string;
  /** Quando o cancelamento devolveu o estoque. `null` enquanto nao houve. */
  stockRestoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---- Produtos ----------------------------------------------------------- */

export interface AdminVariant {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountPercent: number;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
  isAvailable: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryIds: string[];
  images: string[];
  coverImage: string;
  variants: AdminVariant[];
  hasVariants: boolean;
  priceRangeCents: { min: number; max: number };
  discountPercent: number;
  inStock: boolean;
  /** Somado entre as variantes ativas. E o numero da coluna de estoque. */
  totalStock: number;
  isActive: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
