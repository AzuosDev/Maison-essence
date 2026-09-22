import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchCategory,
  fetchCategoryTree,
  fetchProduct,
  fetchShelf,
  fetchSuggestions,
  type ShelfName,
} from './catalog.api';
import { catalogKeys } from './catalog.keys';
import type {
  CategoryTree,
  MovedCategory,
  Paginated,
  PublicProduct,
  PublicProductDetail,
} from './catalog.types';

/**
 * Os hooks de leitura do catalogo.
 *
 * Ficam separados da camada de chamada (`catalog.api.ts`) para que a funcao
 * de rede continue testavel sem React, e para que a politica de cache de cada
 * consulta esteja num lugar so — e nao repetida em cada tela que a usa.
 */

/**
 * A arvore de categorias do menu.
 *
 * Meia hora de frescor: o menu e a mesma coisa em toda visita, e a dona
 * mexer em categoria e evento raro. O `GET /categories` ja vem com cache de
 * borda, entao mesmo a revalidacao costuma ser um `304`.
 */
const CATEGORY_STALE_TIME_MS = 30 * 60 * 1000;

export function useCategoryTree() {
  return useQuery<CategoryTree[]>({
    queryKey: catalogKeys.categoryTree(),
    queryFn: ({ signal }) => fetchCategoryTree(signal),
    staleTime: CATEGORY_STALE_TIME_MS,
  });
}

/** A partir de quantas letras a busca comeca a sugerir. */
export const MIN_SEARCH_LENGTH = 3;

/**
 * As sugestoes da caixa de busca.
 *
 * O termo que chega aqui ja passou pelo atraso de digitacao — quem espera e
 * o `useDebouncedValue` da caixa, e nao esta consulta. Abaixo de tres letras
 * a consulta fica desligada: `pe` traria meio catalogo e gastaria uma ida ao
 * servidor por letra digitada.
 *
 * `placeholderData` mantem o resultado anterior enquanto o novo termo
 * carrega. Sem isso, a lista pisca vazia a cada letra e o cliente ve o menu
 * saltar embaixo do dedo.
 */
export function useSearchSuggestions(term: string) {
  const enabled = term.length >= MIN_SEARCH_LENGTH;

  return useQuery<Paginated<PublicProduct>>({
    queryKey: catalogKeys.suggestions(term),
    queryFn: ({ signal }) => fetchSuggestions(term, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/**
 * Um minuto de frescor para as prateleiras da home.
 *
 * E o mesmo numero que o `QueryClient` ja usa como padrao, e esta escrito de
 * novo aqui de proposito: o padrao vale para a aplicacao inteira e pode mudar
 * por um motivo que nada tem a ver com a vitrine. A prateleira depende deste
 * valor — e o que faz a dona marcar um produto como destaque e ver a home
 * mudar no minuto seguinte, sem redeploy — e por isso ele fica declarado onde
 * a dependencia esta.
 */
const SHELF_STALE_TIME_MS = 60_000;

/**
 * Uma prateleira da home: destaques, pronta entrega ou mais vendidos.
 *
 * As tres compartilham hook, chave e politica de cache porque sao a mesma
 * consulta com outro nome. O `limit` entra na chave: duas larguras diferentes
 * da mesma prateleira sao duas respostas diferentes, e servir uma pela outra
 * faria a lista encolher ou crescer sozinha ao navegar.
 */
export function useShelf(name: ShelfName, limit?: number) {
  return useQuery<PublicProduct[]>({
    queryKey: catalogKeys.shelf(name, limit),
    queryFn: ({ signal }) => fetchShelf(name, limit, signal),
    staleTime: SHELF_STALE_TIME_MS,
  });
}

/* ---- A categoria da pagina --------------------------------------------- */

/**
 * A categoria pelo endereco, com as subcategorias dela.
 *
 * Mesmo frescor do menu: nome e foto de categoria nao mudam durante uma
 * visita. O `enabled` desliga a consulta em `/produtos` e `/busca`, que nao
 * tem categoria nenhuma — sem ele, a vitrine pediria `/categories/` a cada
 * abertura e levaria um 404.
 */
export function useCategory(slug: string | undefined) {
  return useQuery<CategoryTree | MovedCategory>({
    queryKey: catalogKeys.category(slug ?? ''),
    queryFn: ({ signal }) => fetchCategory(slug ?? '', signal),
    enabled: slug !== undefined && slug !== '',
    staleTime: CATEGORY_STALE_TIME_MS,
  });
}

/**
 * A categoria de verdade, ou nada.
 *
 * `GET /categories/:slug` responde 301 quando o endereco mudou de nome, e o
 * navegador segue o redirecionamento sozinho — entao o corpo `MovedCategory`
 * quase nunca chega aqui. Quando chega, e tratado como ausencia: a pagina
 * desenha o cabecalho generico em vez de mostrar `undefined` no titulo.
 */
export function asCategory(data: CategoryTree | MovedCategory | undefined): CategoryTree | null {
  return data !== undefined && 'name' in data ? data : null;
}

/* ---- O produto ---------------------------------------------------------- */

/** O mesmo minuto do resto do catalogo. */
const PRODUCT_STALE_TIME_MS = 60_000;

/**
 * O produto da pagina dele.
 *
 * Mesma chave e mesmo frescor da prebusca do card — e e essa igualdade que
 * torna a navegacao instantanea. Quem passou o mouse pelo card antes de
 * clicar chega aqui e encontra a resposta pronta no cache, sem esqueleto e
 * sem ida a rede.
 *
 * O `enabled` protege do endereco sem slug, que nao existe pela rota mas
 * existe enquanto o React Router resolve os parametros.
 */
export function useProduct(slug: string) {
  return useQuery<PublicProductDetail>({
    queryKey: catalogKeys.product(slug),
    queryFn: ({ signal }) => fetchProduct(slug, signal),
    enabled: slug !== '',
    staleTime: PRODUCT_STALE_TIME_MS,
  });
}

/* ---- Prebusca ----------------------------------------------------------- */

/**
 * O produto sob o cursor, buscado antes do clique.
 *
 * Meio segundo separa o hover do clique, e e tempo de sobra para a API
 * responder. Quando a pagina do produto abrir, ela vai pedir exatamente esta
 * chave e encontrar o dado pronto: a navegacao parece instantanea porque,
 * para os dados, ela e.
 *
 * `prefetchQuery` respeita `staleTime`, entao passar o mouse dez vezes pelo
 * mesmo card e uma requisicao so. A promessa e descartada de proposito —
 * prebusca que falha nao e erro: e so um clique que vai esperar como
 * esperaria sem ela.
 */
export function usePrefetchProduct(): (slug: string) => void {
  const client = useQueryClient();

  return useCallback(
    (slug: string) => {
      void client.prefetchQuery<PublicProductDetail>({
        queryKey: catalogKeys.product(slug),
        queryFn: ({ signal }) => fetchProduct(slug, signal),
        staleTime: PRODUCT_STALE_TIME_MS,
      });
    },
    [client],
  );
}
