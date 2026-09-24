import { api, errorMessage, isApiError, isNetworkError } from '@/lib/http';
import {
  ORDER_FAILURE_KINDS,
  QUOTE_MISMATCH_REASONS,
  type CreateOrderInput,
  type CreatedOrder,
  type OrderFailure,
  type QuoteConflict,
  type QuoteMismatchReason,
} from './order.types';

/**
 * `POST /orders`: o único lugar do checkout onde alguma coisa passa a
 * existir.
 *
 * O escopo e o da loja, que e o padrão do cliente HTTP — e não `scope: null`
 * como na cotação. A diferença e o que liga o pedido a conta: com sessão de
 * cliente, o token sobe junto e o servidor grava o `customerId`; sem sessão,
 * não há cabeçalho nenhum e o pedido nasce de convidado, que continua sendo
 * o caminho padrão. Nada neste corpo muda entre os dois casos — exigir
 * cadastro na última tela seria perder a venda ali.
 *
 * Nada de dinheiro sobe daqui além de `expectedTotalCents`, e ele não entra
 * em conta nenhuma: serve para ser comparado com o total que o servidor
 * recalcula do zero. Divergiu, volta `409` — e e isso que `quoteConflictOf`
 * traduz.
 */
export function createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreatedOrder> {
  return api.post<CreatedOrder>('/orders', input, signal ? { signal } : undefined);
}

/**
 * Lê um `409` de cotação divergente, ou devolve `null` para todo o resto.
 *
 * O servidor manda `{ reason, quote }` no `details` justamente para a tela
 * não precisar comparar dois objetos para descobrir o que mudou — ele já
 * sabe, porque foi ele quem refez a conta. Esta função só confere que o que
 * chegou tem a forma prometida antes de a tela confiar nela: um `409` de
 * outra natureza, ou um corpo sem a cotação, cai como erro comum e vira a
 * mensagem genérica, em vez de abrir um modal comparando `undefined` com
 * `undefined`.
 */
export function quoteConflictOf(error: unknown): QuoteConflict | null {
  if (!isApiError(error) || error.status !== 409 || error.details === null) {
    return null;
  }

  const { reason, quote } = error.details;

  if (!isMismatchReason(reason) || !isQuote(quote)) {
    return null;
  }

  return { reason, quote, message: error.message };
}

/**
 * Classifica o que não foi conflito de cotação.
 *
 * Três desfechos, porque a tela oferece três coisas diferentes — ver
 * `ORDER_FAILURE_KINDS`. O `429` e lido pelo status e não pelo texto: a
 * frase do limite pode ser reescrita no backend a qualquer momento, e o
 * número não.
 *
 * A mensagem sai sempre do erro, nunca daqui. O servidor escreve em
 * português e escreve para quem vai ler; duplicar esse texto no frontend
 * criaria duas versões da mesma explicação.
 */
export function orderFailureOf(error: unknown): OrderFailure {
  const at = Date.now();

  if (isNetworkError(error)) {
    return { kind: ORDER_FAILURE_KINDS.OFFLINE, message: error.message, at };
  }

  if (isApiError(error) && error.status === 429) {
    return { kind: ORDER_FAILURE_KINDS.RATE_LIMIT, message: error.message, at };
  }

  return { kind: ORDER_FAILURE_KINDS.GENERIC, message: errorMessage(error), at };
}

function isMismatchReason(value: unknown): value is QuoteMismatchReason {
  return (
    typeof value === 'string' &&
    (Object.values(QUOTE_MISMATCH_REASONS) as string[]).includes(value)
  );
}

/**
 * A cotação do `details`, conferida pelos campos que a tela vai ler.
 *
 * `totalCents` e `items` bastam: são o que o modal compara e o que a sacola
 * precisa para remontar as linhas. Validar a resposta inteira campo a campo
 * seria reescrever o contrato do backend aqui dentro, e a divergência real —
 * um campo renomeado — apareceria de qualquer jeito, em TypeScript, na
 * primeira leitura.
 */
function isQuote(value: unknown): value is QuoteConflict['quote'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const quote = value as Record<string, unknown>;

  return typeof quote.totalCents === 'number' && Array.isArray(quote.items);
}
