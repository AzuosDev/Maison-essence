import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { fetchProducts } from './catalog.api';
import {
  MAX_API_PAGE_SIZE,
  apiParamsFrom,
  type CatalogContext,
  type CatalogFilters,
} from './catalog.filters';
import { catalogKeys, type ProductListParams } from './catalog.keys';
import {
  EMPTY_SLICE,
  brandsOf,
  ceilingOf,
  pagedSlice,
  saleSlice,
  type ListSlice,
} from './product-list';
import type { Paginated, PublicProduct } from './catalog.types';

/**
 * Os hooks da listagem filtrada.
 *
 * Separados de `use-catalog.ts` por um motivo de empacotamento, e nao de
 * organizacao. Aquele arquivo e alcancavel a partir da moldura da loja — a
 * caixa de busca do cabecalho usa `useSearchSuggestions` —, e tudo o que ele
 * importa entra no pedaco inicial junto. Enquanto `useProductList` morava la,
 * a tabela de ordenacao e a tradutora de filtros iam no primeiro carregamento
 * de quem so queria ver a home.
 *
 * A fronteira e simples de manter: o que depende de `catalog.filters` mora
 * aqui; o que a moldura usa continua la.
 */

/* ---- A listagem -------------------------------------------------------- */

/**
 * O frescor da listagem: o mesmo minuto das prateleiras.
 *
 * Alem de manter a vitrine em dia, e este numero que sustenta o criterio de
 * "voltar do produto preserva a pagina carregada": dentro do minuto, a volta
 * encontra as paginas ja no cache e a lista reaparece inteira, na mesma
 * altura, sem passar por esqueleto nenhum.
 */
const LIST_STALE_TIME_MS = 60_000;

/**
 * Quantas paginas o "carregar mais" empilha antes de parar.
 *
 * O teto existe por dois motivos. Um e de produto: passados dez toques em
 * "carregar mais" — 240 produtos — quem ainda nao achou precisa de filtro, e
 * nao de mais rolagem. O outro e defensivo: a pagina vem da URL, e um
 * `?pagina=300` colado a mao abriria trezentas requisicoes de uma vez.
 */
const MAX_ACCUMULATED_PAGES = 10;

export interface ProductListView extends ListSlice {
  page: number;
  /** Primeira carga, sem nada em tela: e a hora dos esqueletos. */
  isLoading: boolean;
  /** Chegando uma pagina a mais, com a anterior ainda em tela. */
  isFetchingMore: boolean;
  isError: boolean;
}

/**
 * A vitrine filtrada, paginada e pronta para desenhar.
 *
 * ## Uma consulta por pagina
 *
 * Cada pagina da listagem e uma consulta propria, com chave propria. Parece
 * mais trabalho do que uma consulta que guarda tudo, e e justamente o que
 * faz os dois criterios de aceite funcionarem:
 *
 * - **Voltar do produto preserva a pagina carregada.** As paginas 1, 2 e 3
 *   continuam no cache, cada uma na sua chave. A volta as encontra e desenha
 *   as tres de imediato — e e por isso que a posicao de rolagem tem onde
 *   pousar quando o `ScrollRestoration` a devolve.
 * - **Nenhum salto de layout.** `keepPreviousData` mantem a grade anterior
 *   em tela enquanto o novo filtro carrega. Sem isso, cada clique num
 *   checkbox apagaria a lista, mostraria esqueletos e a desenharia de novo.
 *
 * A chave de cada pagina nao inclui a pagina *atual* da tela: a pagina 1
 * tem a mesma chave vindo de `?pagina=1` ou de `?pagina=7`. Sem essa
 * estabilidade, avancar uma pagina invalidaria todas as anteriores e o
 * "carregar mais" rebuscaria tudo a cada toque.
 *
 * ## `accumulate`
 *
 * E o celular. La as paginas se empilham — o cliente aperta "carregar mais"
 * e a proxima entra embaixo. No desktop a paginacao e numerada, so a pagina
 * pedida esta em tela, e uma consulta basta.
 */
export function useProductList(
  filters: CatalogFilters,
  context: CatalogContext = {},
  accumulate = false,
): ProductListView {
  const params = apiParamsFrom(filters, context);
  const pages = pagesToLoad(filters, accumulate);

  const results = useQueries({
    queries: pages.map((page) => {
      // A pagina entra por ultimo e sobrescreve o que `apiParamsFrom`
      // deduziu, para que a chave de cada pagina independa de qual delas a
      // URL esta pedindo agora.
      const pageParams = page === 1 ? omitPage(params) : { ...params, page };

      return {
        queryKey: catalogKeys.productList(pageParams),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchProducts(pageParams, signal),
        staleTime: LIST_STALE_TIME_MS,
        placeholderData: keepPreviousData,
      };
    }),
  });

  const loaded = results.flatMap((result) => (result.data === undefined ? [] : [result.data]));
  const pending = results.some((result) => result.isPending);

  return {
    ...sliceFor(filters, loaded, accumulate),
    page: filters.page,
    isLoading: pending && loaded.length === 0,
    isFetchingMore: pending && loaded.length > 0,
    isError: loaded.length === 0 && results.some((result) => result.isError),
  };
}

/** Quais paginas buscar: a varredura unica, a pilha do celular, ou uma so. */
function pagesToLoad(filters: CatalogFilters, accumulate: boolean): number[] {
  // O filtro de desconto e sempre uma varredura unica da primeira pagina
  // cheia; quem a recorta e `saleSlice`.
  if (filters.onSale) {
    return [1];
  }

  if (!accumulate) {
    return [filters.page];
  }

  const top = Math.min(filters.page, MAX_ACCUMULATED_PAGES);

  return Array.from({ length: top }, (_, index) => index + 1);
}

function sliceFor(
  filters: CatalogFilters,
  loaded: Paginated<PublicProduct>[],
  accumulate: boolean,
): ListSlice {
  if (!filters.onSale) {
    return pagedSlice(loaded);
  }

  const scan = loaded[0];

  return scan === undefined ? EMPTY_SLICE : saleSlice(scan.items, filters.page, accumulate);
}

function omitPage(params: ProductListParams): ProductListParams {
  const { page: _page, ...rest } = params;

  return rest;
}

/* ---- As opcoes da barra de filtros ------------------------------------- */

/**
 * As marcas e o teto de preco que a barra lateral oferece.
 *
 * Saem de uma varredura do proprio catalogo, e nao de uma rota de facetas:
 * a API publica nao tem uma. A varredura pede a pagina cheia do backend (48)
 * ordenada por maior preco, o que da duas coisas de uma vez — o teto do
 * slider sai exato do primeiro item, e as marcas saem dos produtos lidos.
 *
 * O limite esta assumido: numa categoria com mais de 48 produtos, a lista de
 * marcas e a dos 48 mais caros, e pode faltar a marca que so aparece na
 * faixa barata. Para o tamanho deste catalogo isso significa a lista
 * inteira; se o catalogo crescer, o conserto e uma rota de facetas no
 * backend, e nao mais codigo aqui.
 *
 * A chave ignora marca, preco e pagina de proposito: as opcoes do filtro
 * descrevem o contexto — a categoria, a busca — e nao o recorte atual. Se
 * elas mudassem junto, escolher "Lattafa" deixaria "Lattafa" como unica
 * marca da lista e nao haveria como voltar atras.
 */
export interface CatalogFacets {
  brands: string[];
  /** O maior preco do contexto, em centavos. Zero enquanto nao carregou. */
  ceilingCents: number;
  isLoading: boolean;
}

export function useCatalogFacets(q: string, context: CatalogContext = {}): CatalogFacets {
  const params: ProductListParams = {
    ...(context.category === undefined || context.category === ''
      ? {}
      : { category: context.category }),
    ...(q === '' ? {} : { q }),
    ...(context.readyToShip === true ? { readyToShip: true } : {}),
    sort: 'price_desc',
    limit: MAX_API_PAGE_SIZE,
  };

  const { data, isPending } = useQuery<Paginated<PublicProduct>>({
    queryKey: catalogKeys.facets(params),
    queryFn: ({ signal }) => fetchProducts(params, signal),
    staleTime: LIST_STALE_TIME_MS,
  });

  const items = data?.items ?? [];

  return {
    brands: brandsOf(items),
    ceilingCents: ceilingOf(items),
    isLoading: isPending,
  };
}
