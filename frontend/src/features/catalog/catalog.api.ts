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
 * As chamadas públicas do catálogo.
 *
 * Todas com `scope: null`: o catálogo e aberto, e um `401` aqui não teria
 * sessão para renovar.
 */

/** A árvore inteira do menu, só com o que esta ativo. */
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
 * As sugestões da busca.
 *
 * Poucas e de propósito: a caixa de sugestão e um atalho para o produto que o
 * cliente já tem em mente, e não a página de resultados. Quem quer ver tudo
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
 * Três rotas de nome fixo — `/products/featured`, `/products/ready-to-ship`
 * e `/products/best-sellers` — e uma função só, porque as três respondem a
 * mesma coisa: uma lista curta, **sem paginação**. Prateleira tem começo e
 * fim; quem quer navegar o catálogo inteiro vai para `/products`, que página.
 *
 * O `limit` fica opcional para que a home não precise repetir o padrão do
 * backend (doze). Quem passa um número e quem tem motivo — uma prateleira de
 * quatro no rodapé do produto, por exemplo.
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
 * A prateleira de novidades: o catálogo inteiro, do mais novo para o mais
 * velho.
 *
 * Não tem rota própria como as outras três, e não precisa: e `GET /products`
 * com `sort=newest` e um teto, que e exatamente a consulta que o backend faz
 * dentro de `/products/featured` — só que sem o filtro. Criar um quarto
 * endereço para repetir isso seria uma rota a mais para manter.
 *
 * O que a torna diferente das outras e que ela não depende de ninguém: as
 * outras três respondem a marcação no painel (destaque, pronta entrega) ou
 * ao histórico de pedidos (mais vendidos), e as três saem vazias numa loja
 * recém-cadastrada. Esta tem produto no minuto em que o catálogo tem — e e
 * o que garante que a home nunca abra sem perfume nenhum.
 *
 * Devolve só os itens: quem consome e uma prateleira, que não página.
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
 * Uma prateleira de marca.
 *
 * Cinco, e não os doze de novidades: a prateleira de marca não e para navegar
 * o acervo da marca inteira — e uma amostra que diz "temos esta marca" e leva
 * para a vitrine já filtrada por ela. Quem quer ver as sessenta e duas
 * Isabelle clica no atalho do título.
 *
 * Não tem rota própria, como novidades: e `GET /products` com o filtro de
 * marca. O filtro do backend casa a marca inteira, ignorando maiúscula —
 * `lattafa` acha `Lattafa` e não acha `Lattafa Qaed`.
 *
 * **As setas apagadas no monitor largo não são defeito.** Acima de 1360px
 * cabem cinco cards e meio na fileira, então cinco produtos não transbordam:
 * a prateleira não rola, e as setas nascem desligadas — que e o tratamento
 * certo, e não seta acesa sem ter para onde levar. Do celular até 1280px a
 * fileira transborda e o carrossel anda normalmente. Quem trocar este número
 * por doze ganha o carrossel no desktop e perde a fileira curta; foi uma
 * escolha, não um esquecimento.
 */
export const BRAND_SHELF_LIMIT = 5;

/**
 * Por data de cadastro, e não pela ordem natural do banco.
 *
 * A fileira mostra cinco de um acervo que tem dezenas: sem ordem declarada,
 * os cinco seriam sempre os mesmos e a prateleira envelheceria junto com o
 * catálogo. Por data, o que a loja acabou de cadastrar aparece na home no
 * minuto seguinte, que e o mesmo critério de "Novidades".
 */
export async function fetchBrandShelf(
  brand: string,
  limit = BRAND_SHELF_LIMIT,
  signal?: AbortSignal,
): Promise<PublicProduct[]> {
  const page = await fetchProducts({ brand, sort: 'newest', limit }, signal);

  return page.items;
}

/**
 * Um produto pelo endereço dele.
 *
 * Quem chama hoje e a prebusca do card no hover; a página do produto usa a
 * mesma função e a mesma chave de cache quando chegar — e por isso encontra
 * o produto já carregado no clique.
 */
export function fetchProduct(slug: string, signal?: AbortSignal): Promise<PublicProductDetail> {
  return api.get<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Uma categoria pelo endereço, com as subcategorias dela.
 *
 * E o que o cabeçalho da listagem precisa: o nome para o título, a contagem
 * para o subtítulo e os filhos para as pílulas de subcategoria. Vem daqui e
 * não da árvore do menu porque a árvore traz só as raizes com um nível — e
 * esta rota responde também quando o slug pedido e o de uma subcategoria.
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
