import { useQuery } from '@tanstack/react-query';
import { fetchCategoryTree, fetchSuggestions } from './catalog.api';
import { catalogKeys } from './catalog.keys';
import type { CategoryTree, Paginated, PublicProduct } from './catalog.types';

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
