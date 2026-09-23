import { api } from '@/lib/http';
import type {
  CategoryTree,
  MovedCategory,
  Paginated,
  PublicProduct,
  PublicProductDetail,
} from './catalog.types';
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

/**
 * A prateleira de novidades: o catalogo inteiro, do mais novo para o mais
 * velho.
 *
 * Nao tem rota propria como as outras tres, e nao precisa: e `GET /products`
 * com `sort=newest` e um teto, que e exatamente a consulta que o backend faz
 * dentro de `/products/featured` — so que sem o filtro. Criar um quarto
 * endereco para repetir isso seria uma rota a mais para manter.
 *
 * O que a torna diferente das outras e que ela nao depende de ninguem: as
 * outras tres respondem a marcacao no painel (destaque, pronta entrega) ou
 * ao historico de pedidos (mais vendidos), e as tres saem vazias numa loja
 * recem-cadastrada. Esta tem produto no minuto em que o catalogo tem — e e
 * o que garante que a home nunca abra sem perfume nenhum.
 *
 * Devolve so os itens: quem consome e uma prateleira, que nao pagina.
 */
export const LATEST_SHELF_LIMIT = 12;

export async function fetchLatest(
  limit = LATEST_SHELF_LIMIT,
  signal?: AbortSignal,
): Promise<PublicProduct[]> {
  const page = await fetchProducts({ sort: 'newest', limit }, signal);

  return page.items;
}

/**
 * Um produto pelo endereco dele.
 *
 * Quem chama hoje e a prebusca do card no hover; a pagina do produto usa a
 * mesma funcao e a mesma chave de cache quando chegar — e por isso encontra
 * o produto ja carregado no clique.
 */
export function fetchProduct(slug: string, signal?: AbortSignal): Promise<PublicProductDetail> {
  return api.get<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Uma categoria pelo endereco, com as subcategorias dela.
 *
 * E o que o cabecalho da listagem precisa: o nome para o titulo, a contagem
 * para o subtitulo e os filhos para as pilulas de subcategoria. Vem daqui e
 * nao da arvore do menu porque a arvore traz so as raizes com um nivel — e
 * esta rota responde tambem quando o slug pedido e o de uma subcategoria.
 */
export function fetchCategory(
  slug: string,
  signal?: AbortSignal,
): Promise<CategoryTree | MovedCategory> {
  return api.get<CategoryTree | MovedCategory>(`/categories/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
