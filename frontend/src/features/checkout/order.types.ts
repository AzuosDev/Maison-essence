import type { CartQuote } from '@/features/cart';
import type { FulfillmentMode, PaymentMethod } from './checkout.types';

/**
 * O pedido, como `POST /orders` o recebe e o devolve.
 *
 * Espelho de `create-order.dto.ts` e `order.view.ts` do backend, escrito a
 * mao porque as duas pastas sao projetos separados — o frontend consome a
 * API publicada, nao o codigo dela.
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

/** O endereco como o pedido o recebe. Sem CEP: a loja nao calcula por ele. */
export interface OrderAddressInput {
  street: string;
  number: string;
  complement: string;
  district: string;
  reference: string;
}

/**
 * O corpo de `POST /orders`.
 *
 * E o corpo da cotacao mais tres coisas: quem compra, para onde vai e o
 * total que estava na tela.
 */
export interface CreateOrderInput {
  items: { productId: string; variantId: string; quantity: number }[];
  fulfillment: { mode: FulfillmentMode; cityId?: string };
  payment: { method: PaymentMethod; installments?: number };
  customer: {
    name: string;
    /** Onze digitos, ja normalizados. O servidor valida de novo. */
    phone: string;
  };
  /** Obrigatorio na entrega, ausente na retirada. */
  address?: OrderAddressInput;
  /**
   * O total que o cliente viu, em centavos.
   *
   * Nao entra em conta nenhuma: e conferencia. O servidor refaz a cotacao
   * inteira e compara — se o preco subiu, o desconto venceu ou o estoque
   * acabou entre montar a sacola e fechar o pedido, a diferenca aparece e o
   * pedido volta em `409` com a cotacao nova, em vez de ser gravado por um
   * valor que ninguem combinou.
   */
  expectedTotalCents: number;
}

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

export interface OrderTotalsView {
  subtotalCents: number;
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
}

/** O pedido gravado, com os precos congelados no momento em que fechou. */
export interface CustomerOrder {
  id: string;
  /** `ME-AAMMDD-XXXX`. E o que o cliente repete no WhatsApp. */
  code: string;
  status: OrderStatus;
  items: OrderItemView[];
  customer: { name: string; phone: string; phoneLabel: string; email: string };
  fulfillment: {
    mode: FulfillmentMode;
    cityId: string | null;
    cityName: string;
    state: string;
    estimatedDays: number;
    address: (OrderAddressInput & { zipCode: string }) | null;
  };
  payment: { method: PaymentMethod; installments: number; hasInterest: boolean };
  totals: OrderTotalsView;
  /** A mensagem como o servidor a montou, para a tela oferecer copiar. */
  whatsappMessage: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A resposta de `POST /orders`.
 *
 * `whatsappUrl` e o campo que fecha o fluxo: ela ja vem com a mensagem
 * montada e codificada pelo servidor. O frontend **nao** escreve essa
 * mensagem — duas versoes do mesmo texto divergiriam no primeiro ajuste, e a
 * que o cliente manda tem que ser a que ficou gravada no pedido.
 *
 * Vazia quando a loja ainda nao cadastrou o numero do WhatsApp.
 */
export interface CreatedOrder {
  orderId: string;
  code: string;
  whatsappUrl: string;
  order: CustomerOrder;
}

/* ---- O 409 --------------------------------------------------------------- */

/**
 * Por que a cotacao refeita nao bateu com a que o cliente viu.
 *
 * Vem no `details` do 409, junto da cotacao nova. Sao quatro motivos porque
 * pedem quatro conversas diferentes: "o valor mudou" da para confirmar na
 * hora; "um item acabou" exige voltar a sacola. Espelho de
 * `QUOTE_MISMATCH_REASONS` no backend.
 */
export const QUOTE_MISMATCH_REASONS = {
  /** Algum item ficou indisponivel entre a cotacao e o envio. */
  ITEMS: 'items',
  /** O total recalculado e outro. */
  TOTAL: 'total',
  /** O parcelamento escolhido nao cabe mais neste total. */
  INSTALLMENTS: 'installments',
  /** Perdeu a corrida pelo estoque: a ultima unidade acabou de ser vendida. */
  STOCK: 'stock',
} as const;

export type QuoteMismatchReason =
  (typeof QUOTE_MISMATCH_REASONS)[keyof typeof QUOTE_MISMATCH_REASONS];

/** O 409 ja lido: o motivo, a frase do servidor e a cotacao refeita. */
export interface QuoteConflict {
  reason: QuoteMismatchReason;
  /** A frase que o servidor escreveu, em portugues, pronta para a tela. */
  message: string;
  quote: CartQuote;
}

/**
 * O conflito que o cliente pode resolver confirmando o valor novo.
 *
 * Valor e parcelamento, sim: nao falta nada para o pedido existir, so mudou
 * quanto ele custa — e decidir isso e de quem paga. Confirmar reenvia o
 * mesmo pedido com o total recalculado, e ele passa.
 *
 * Item indisponivel e estoque perdido, nao. Confirmar ali reenviaria a mesma
 * sacola com o mesmo item que nao existe mais, para receber o mesmo `409`:
 * um botao que so pode falhar. Nesses dois casos o caminho e voltar a lista
 * de itens e tirar o que saiu, e e isso que o modal oferece.
 *
 * A regra mora aqui, e nao no componente, porque o envio tambem precisa
 * dela: e o mesmo criterio decidindo o que o botao oferece e o que o
 * reenvio aceita fazer.
 */
export function isConfirmableConflict(reason: QuoteMismatchReason): boolean {
  return reason === QUOTE_MISMATCH_REASONS.TOTAL || reason === QUOTE_MISMATCH_REASONS.INSTALLMENTS;
}

/* ---- O que mais pode dar errado no envio ---------------------------------- */

/**
 * As tres falhas de envio que pedem conversas diferentes.
 *
 * Uma frase vermelha unica serviria para as tres e nao ajudaria em nenhuma.
 * O que muda nao e o tom: e o que a tela oferece a seguir.
 *
 * - `OFFLINE`: a requisicao nem chegou. O pedido **nao** existe, nada foi
 *   cobrado e nada foi perdido — o botao certo e "tentar de novo".
 * - `RATE_LIMIT`: o servidor recusou por excesso de tentativas. Aqui o botao
 *   de repetir imediatamente e uma armadilha, porque a causa mais comum e
 *   alguem que ja enviou o pedido algumas vezes — e alguma delas pode ter
 *   dado certo. A tela pede para esperar e conferir a conversa antes.
 * - `GENERIC`: o resto. A frase vem do servidor, que escreve em portugues, e
 *   repetir continua sendo uma acao razoavel.
 *
 * O `409` de cotacao divergente nao esta aqui de proposito: ele nao e falha,
 * e uma decisao — e tem o seu proprio caminho, em `QuoteConflict`.
 */
export const ORDER_FAILURE_KINDS = {
  OFFLINE: 'offline',
  RATE_LIMIT: 'rate-limit',
  GENERIC: 'generic',
} as const;

export type OrderFailureKind = (typeof ORDER_FAILURE_KINDS)[keyof typeof ORDER_FAILURE_KINDS];

export interface OrderFailure {
  kind: OrderFailureKind;
  /** A frase pronta para a tela, escrita pelo servidor quando houve um. */
  message: string;
  /**
   * O instante em que esta falha chegou, em milissegundos.
   *
   * Existe para a tela saber que uma falha e **outra** falha, e nao a mesma
   * ainda em cartaz: duas recusas por excesso de tentativas trazem o mesmo
   * texto e o mesmo motivo, e sem este campo a espera de trinta segundos
   * continuaria correndo a partir da primeira.
   */
  at: number;
}
