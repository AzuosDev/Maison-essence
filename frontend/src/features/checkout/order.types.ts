import type { CartQuote } from '@/features/cart';
import type { FulfillmentMode, PaymentMethod } from './checkout.types';

/**
 * O pedido, como `POST /orders` o recebe e o devolve.
 *
 * Espelho de `create-order.dto.ts` e `order.view.ts` do backend, escrito a
 * mão porque as duas pastas são projetos separados — o frontend consome a
 * API publicada, não o código dela.
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

/** O endereço como o pedido o recebe. Sem CEP: a loja não calcula por ele. */
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
 * E o corpo da cotação mais três coisas: quem compra, para onde vai e o
 * total que estava na tela.
 */
export interface CreateOrderInput {
  items: { productId: string; variantId: string; quantity: number }[];
  fulfillment: { mode: FulfillmentMode; cityId?: string };
  payment: { method: PaymentMethod; installments?: number };
  customer: {
    name: string;
    /** Onze digitos, já normalizados. O servidor valida de novo. */
    phone: string;
  };
  /** Obrigatório na entrega, ausente na retirada. */
  address?: OrderAddressInput;
  /**
   * O total que o cliente viu, em centavos.
   *
   * Não entra em conta nenhuma: e conferência. O servidor refaz a cotação
   * inteira e compara — se o preço subiu, o desconto venceu ou o estoque
   * acabou entre montar a sacola e fechar o pedido, a diferença aparece e o
   * pedido volta em `409` com a cotação nova, em vez de ser gravado por um
   * valor que ninguém combinou.
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

/** O pedido gravado, com os preços congelados no momento em que fechou. */
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
 * `whatsappUrl` e o campo que fecha o fluxo: ela já vem com a mensagem
 * montada e codificada pelo servidor. O frontend **não** escreve essa
 * mensagem — duas versões do mesmo texto divergiriam no primeiro ajuste, e a
 * que o cliente manda tem que ser a que ficou gravada no pedido.
 *
 * Vazia quando a loja ainda não cadastrou o número do WhatsApp.
 */
export interface CreatedOrder {
  orderId: string;
  code: string;
  whatsappUrl: string;
  order: CustomerOrder;
}

/* ---- O 409 --------------------------------------------------------------- */

/**
 * Por que a cotação refeita não bateu com a que o cliente viu.
 *
 * Vem no `details` do 409, junto da cotação nova. São quatro motivos porque
 * pedem quatro conversas diferentes: "o valor mudou" da para confirmar na
 * hora; "um item acabou" exige voltar a sacola. Espelho de
 * `QUOTE_MISMATCH_REASONS` no backend.
 */
export const QUOTE_MISMATCH_REASONS = {
  /** Algum item ficou indisponível entre a cotação e o envio. */
  ITEMS: 'items',
  /** O total recalculado e outro. */
  TOTAL: 'total',
  /** O parcelamento escolhido não cabe mais neste total. */
  INSTALLMENTS: 'installments',
  /** Perdeu a corrida pelo estoque: a última unidade acabou de ser vendida. */
  STOCK: 'stock',
} as const;

export type QuoteMismatchReason =
  (typeof QUOTE_MISMATCH_REASONS)[keyof typeof QUOTE_MISMATCH_REASONS];

/** O 409 já lido: o motivo, a frase do servidor e a cotação refeita. */
export interface QuoteConflict {
  reason: QuoteMismatchReason;
  /** A frase que o servidor escreveu, em português, pronta para a tela. */
  message: string;
  quote: CartQuote;
}

/**
 * O conflito que o cliente pode resolver confirmando o valor novo.
 *
 * Valor e parcelamento, sim: não falta nada para o pedido existir, só mudou
 * quanto ele custa — e decidir isso e de quem paga. Confirmar reenvia o
 * mesmo pedido com o total recalculado, e ele passa.
 *
 * Item indisponível e estoque perdido, não. Confirmar ali reenviaria a mesma
 * sacola com o mesmo item que não existe mais, para receber o mesmo `409`:
 * um botão que só pode falhar. Nesses dois casos o caminho e voltar a lista
 * de itens e tirar o que saiu, e e isso que o modal oferece.
 *
 * A regra mora aqui, e não no componente, porque o envio também precisa
 * dela: e o mesmo critério decidindo o que o botão oferece e o que o
 * reenvio aceita fazer.
 */
export function isConfirmableConflict(reason: QuoteMismatchReason): boolean {
  return reason === QUOTE_MISMATCH_REASONS.TOTAL || reason === QUOTE_MISMATCH_REASONS.INSTALLMENTS;
}

/* ---- O que mais pode dar errado no envio ---------------------------------- */

/**
 * As três falhas de envio que pedem conversas diferentes.
 *
 * Uma frase vermelha única serviria para as três e não ajudaria em nenhuma.
 * O que muda não e o tom: e o que a tela oferece a seguir.
 *
 * - `OFFLINE`: a requisição nem chegou. O pedido **não** existe, nada foi
 *   cobrado e nada foi perdido — o botão certo e "tentar de novo".
 * - `RATE_LIMIT`: o servidor recusou por excesso de tentativas. Aqui o botão
 *   de repetir imediatamente e uma armadilha, porque a causa mais comum e
 *   alguém que já enviou o pedido algumas vezes — e alguma delas pode ter
 *   dado certo. A tela pede para esperar e conferir a conversa antes.
 * - `GENERIC`: o resto. A frase vem do servidor, que escreve em português, e
 *   repetir continua sendo uma ação razoável.
 *
 * O `409` de cotação divergente não esta aqui de propósito: ele não e falha,
 * e uma decisão — e tem o seu próprio caminho, em `QuoteConflict`.
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
   * Existe para a tela saber que uma falha e **outra** falha, e não a mesma
   * ainda em cartaz: duas recusas por excesso de tentativas trazem o mesmo
   * texto e o mesmo motivo, e sem este campo a espera de trinta segundos
   * continuaria correndo a partir da primeira.
   */
  at: number;
}
