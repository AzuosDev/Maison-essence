import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Cinco pedidos por dez minutos, contados duas vezes: por IP e por telefone.
 *
 * Sao dois contadores porque sao dois abusos diferentes. O mesmo IP abrindo
 * pedidos em sequencia e o robo; o mesmo telefone chegando de IPs diferentes e
 * o mesmo robo com proxy, ou — muito mais comum — o cliente ansioso que
 * reenviou o formulario seis vezes porque a conexao estava lenta. Cinco cobre
 * a familia inteira pedindo do mesmo wi-fi e ainda assim corta o laco.
 */
export const ORDER_IP_RATE_LIMIT: RateLimitRule = {
  scope: 'order-create-ip',
  limit: 5,
  windowSeconds: 600,
};

export const ORDER_PHONE_RATE_LIMIT: RateLimitRule = {
  scope: 'order-create-phone',
  limit: 5,
  windowSeconds: 600,
};

/** Quantas vezes tentar de novo quando o codigo sorteado ja existe. */
export const ORDER_CODE_ATTEMPTS = 3;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const ORDER_NOT_FOUND_MESSAGE = 'Pedido não encontrado.';

/**
 * Por que a cotacao refeita nao bate com a que o cliente viu.
 *
 * Vai no `details` do 409 junto da cotacao nova, para o frontend saber o que
 * destacar na tela: "o preco mudou" e "acabou o estoque" pedem avisos
 * diferentes, e adivinhar isso comparando dois objetos seria trabalho que o
 * servidor ja fez.
 */
export const QUOTE_MISMATCH_REASONS = {
  ITEMS: 'items',
  TOTAL: 'total',
  INSTALLMENTS: 'installments',
  STOCK: 'stock',
} as const;

export type QuoteMismatchReason =
  (typeof QUOTE_MISMATCH_REASONS)[keyof typeof QUOTE_MISMATCH_REASONS];

export const ITEMS_UNAVAILABLE_MESSAGE =
  'Um ou mais itens da sacola não estão mais disponíveis. Confira o pedido antes de continuar.';

export const TOTAL_CHANGED_MESSAGE =
  'O valor do pedido mudou desde que você montou a sacola. ' +
  'Confira o novo total antes de continuar.';

export const INSTALLMENTS_CHANGED_MESSAGE =
  'O parcelamento escolhido não esta mais disponível para este total. ' +
  'Confira as opções antes de continuar.';

/** Perdeu a corrida pelo estoque entre a cotacao e a gravacao. */
export const STOCK_TAKEN_MESSAGE =
  'A última unidade de um dos itens acabou de ser vendida. Confira a sacola antes de continuar.';

/** A forma de pagamento saiu do ar entre a cotacao e o fechamento. */
export const PAYMENT_UNAVAILABLE_MESSAGE =
  'A forma de pagamento escolhida não esta mais disponível. Escolha outra para continuar.';

/**
 * Cancelamento e o fim da linha.
 *
 * Reabrir um pedido cancelado obrigaria a descontar de novo o estoque que o
 * cancelamento devolveu, e esse desconto pode falhar — a unidade devolvida ja
 * foi vendida a outra pessoa. Um pedido que volta ao ar sem estoque para
 * atende-lo e pior do que um pedido novo: o certo e refazer.
 */
export const CANCELLED_IS_FINAL_MESSAGE =
  'Pedido cancelado não volta atrás. Crie um novo pedido para o cliente.';
