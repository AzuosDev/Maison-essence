import { api, isApiError } from '@/lib/http';
import {
  QUOTE_MISMATCH_REASONS,
  type CreateOrderInput,
  type CreatedOrder,
  type QuoteConflict,
  type QuoteMismatchReason,
} from './order.types';

/**
 * `POST /orders`: o unico lugar do checkout onde alguma coisa passa a
 * existir.
 *
 * O escopo e o da loja, que e o padrao do cliente HTTP — e nao `scope: null`
 * como na cotacao. A diferenca e o que liga o pedido a conta: com sessao de
 * cliente, o token sobe junto e o servidor grava o `customerId`; sem sessao,
 * nao ha cabecalho nenhum e o pedido nasce de convidado, que continua sendo
 * o caminho padrao. Nada neste corpo muda entre os dois casos — exigir
 * cadastro na ultima tela seria perder a venda ali.
 *
 * Nada de dinheiro sobe daqui alem de `expectedTotalCents`, e ele nao entra
 * em conta nenhuma: serve para ser comparado com o total que o servidor
 * recalcula do zero. Divergiu, volta `409` — e e isso que `quoteConflictOf`
 * traduz.
 */
export function createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreatedOrder> {
  return api.post<CreatedOrder>('/orders', input, signal ? { signal } : undefined);
}

/**
 * Le um `409` de cotacao divergente, ou devolve `null` para todo o resto.
 *
 * O servidor manda `{ reason, quote }` no `details` justamente para a tela
 * nao precisar comparar dois objetos para descobrir o que mudou — ele ja
 * sabe, porque foi ele quem refez a conta. Esta funcao so confere que o que
 * chegou tem a forma prometida antes de a tela confiar nela: um `409` de
 * outra natureza, ou um corpo sem a cotacao, cai como erro comum e vira a
 * mensagem generica, em vez de abrir um modal comparando `undefined` com
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

function isMismatchReason(value: unknown): value is QuoteMismatchReason {
  return (
    typeof value === 'string' &&
    (Object.values(QUOTE_MISMATCH_REASONS) as string[]).includes(value)
  );
}

/**
 * A cotacao do `details`, conferida pelos campos que a tela vai ler.
 *
 * `totalCents` e `items` bastam: sao o que o modal compara e o que a sacola
 * precisa para remontar as linhas. Validar a resposta inteira campo a campo
 * seria reescrever o contrato do backend aqui dentro, e a divergencia real —
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
