import { api } from '@/lib/http';
import type { CategoryTree, Paginated, PublicProduct } from './catalog.types';
import type { ProductListParams } from './catalog.keys';

/**
 * As chamadas publicas do catalogo.
 *
 * Todas com `scope: null`: o catalogo e aberto, e um `401` aqui nao teria
 * sessao para renovar.
 */

/** A arvore inteira do menu, so com o que esta ativo. */
export function fetchCategoryTree(signal?: AbortSignal): Promise<CategoryTree[]> {
  return api.get<CategoryTree[]>('/categories', { scope: null, ...(signal ? { signal } : {}) });
}

export function fetchProducts(
  params: ProductListParams,
  signal?: AbortSignal,
): Promise<Paginated<PublicProduct>> {
  return api.get<Paginated<PublicProduct>>('/products', {
    scope: null,
    query: params,
    ...(signal ? { signal } : {}),
  });
}

/**
 * As sugestoes da busca.
 *
 * Poucas e de proposito: a caixa de sugestao e um atalho para o produto que o
 * cliente ja tem em mente, e nao a pagina de resultados. Quem quer ver tudo
 * aperta Enter e vai para a busca inteira.
 */
export const SUGGESTION_LIMIT = 6;

export function fetchSuggestions(
  term: string,
  signal?: AbortSignal,
): Promise<Paginated<PublicProduct>> {
  return fetchProducts({ q: term, limit: SUGGESTION_LIMIT }, signal);
}

/**
 * As prateleiras da home.
 *
 * Tres rotas de nome fixo — `/products/featured`, `/products/ready-to-ship`
 * e `/products/best-sellers` — e uma funcao so, porque as tres respondem a
 * mesma coisa: uma lista curta, **sem paginacao**. Prateleira tem comeco e
 * fim; quem quer navegar o catalogo inteiro vai para `/products`, que pagina.
 *
 * O `limit` fica opcional para que a home nao precise repetir o padrao do
 * backend (doze). Quem passa um numero e quem tem motivo — uma prateleira de
 * quatro no rodape do produto, por exemplo.
 */
export type ShelfName = 'featured' | 'ready-to-ship' | 'best-sellers';

export function fetchShelf(
  name: ShelfName,
  limit?: number,
  signal?: AbortSignal,
): Promise<PublicProduct[]> {
  return api.get<PublicProduct[]>(`/products/${name}`, {
    scope: null,
    ...(limit === undefined ? {} : { query: { limit } }),
    ...(signal ? { signal } : {}),
  });
}
