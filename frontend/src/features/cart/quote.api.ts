import type { QuoteInput } from '@/features/checkout';
import { api } from '@/lib/http';
import type { CartQuote } from './quote.types';

/**
 * `POST /cart/quote`: quanto da isto, agora.
 *
 * `scope: null` porque a sacola e de quem ainda nao se identificou — exigir
 * sessao para ver o total seria perder a venda antes dela comecar. Quem esta
 * logado tambem passa por aqui: a cotacao nao muda com a conta.
 *
 * E um `POST` que nao cria nada. O servidor responde `200`, nao reserva
 * estoque e nao deixa rastro; pode ser repetido a vontade — que e
 * exatamente o que a sacola faz a cada clique no mais e no menos.
 */
export function fetchCartQuote(input: QuoteInput, signal?: AbortSignal): Promise<CartQuote> {
  return api.post<CartQuote>('/cart/quote', input, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
