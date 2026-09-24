import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  BRAND_SHELF_LIMIT,
  fetchBrandShelf,
  fetchCategory,
  fetchCategoryTree,
  fetchLatest,
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
 * Os hooks de leitura do catálogo.
 *
 * Ficam separados da camada de chamada (`catalog.api.ts`) para que a função
 * de rede continue testável sem React, e para que a política de cache de cada
 * consulta esteja num lugar só — e não repetida em cada tela que a usa.
 */

/**
 * A árvore de categorias do menu.
 *
 * Meia hora de frescor: o menu e a mesma coisa em toda visita, e a dona
 * mexer em categoria e evento raro. O `GET /categories` já vem com cache de
 * borda, então mesmo a revalidação costuma ser um `304`.
 */
const CATEGORY_STALE_TIME_MS = 30 * 60 * 1000;

export function useCategoryTree() {
  return useQuery<CategoryTree[]>({
    queryKey: catalogKeys.categoryTree(),
    queryFn: ({ signal }) => fetchCategoryTree(signal),
    staleTime: CATEGORY_STALE_TIME_MS,
  });
}

/** A partir de quantas letras a busca começa a sugerir. */
export const MIN_SEARCH_LENGTH = 3;

/**
 * As sugestões da caixa de busca.
 *
 * O termo que chega aqui já passou pelo atraso de digitação — quem espera e
 * o `useDebouncedValue` da caixa, e não esta consulta. Abaixo de três letras
 * a consulta fica desligada: `pe` traria meio catálogo e gastaria uma ida ao
 * servidor por letra digitada.
 *
 * `placeholderData` mantem o resultado anterior enquanto o novo termo
 * carrega. Sem isso, a lista pisca vazia a cada letra e o cliente vê o menu
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
 * E o mesmo número que o `QueryClient` já usa como padrão, e esta escrito de
 * novo aqui de propósito: o padrão vale para a aplicação inteira e pode mudar
 * por um motivo que nada tem a ver com a vitrine. A prateleira depende deste
 * valor — e o que faz a dona marcar um produto como destaque e ver a home
 * mudar no minuto seguinte, sem redeploy — e por isso ele fica declarado onde
 * a dependência esta.
 */
const SHELF_STALE_TIME_MS = 60_000;

/**
 * Uma prateleira da home: destaques, pronta entrega ou mais vendidos.
 *
 * As três compartilham hook, chave e política de cache porque são a mesma
 * consulta com outro nome. O `limit` entra na chave: duas larguras diferentes
 * da mesma prateleira são duas respostas diferentes, e servir uma pela outra
 * faria a lista encolher ou crescer sozinha ao navegar.
 */
export function useShelf(name: ShelfName, limit?: number) {
  return useQuery<PublicProduct[]>({
    queryKey: catalogKeys.shelf(name, limit),
    queryFn: ({ signal }) => fetchShelf(name, limit, signal),
    staleTime: SHELF_STALE_TIME_MS,
  });
}

/**
 * A prateleira de novidades.
 *
 * Hook próprio, e não `useShelf`, porque a origem e outra: as três do
 * `useShelf` são rotas de prateleira, e esta e a listagem do catálogo com um
 * teto. A chave e a política de cache são as mesmas de propósito — para a
 * home ela e uma prateleira como as outras.
 */
export function useLatest(limit?: number) {
  return useQuery<PublicProduct[]>({
    queryKey: catalogKeys.shelf('latest', limit),
    queryFn: ({ signal }) => fetchLatest(limit, signal),
    staleTime: SHELF_STALE_TIME_MS,
  });
}

/**
 * A prateleira de uma marca.
 *
 * Mesma política das outras: a dona cadastra um perfume da marca e ele
 * aparece na home no minuto seguinte, sem redeploy.
 */
export function useBrandShelf(brand: string, limit?: number) {
  return useQuery<PublicProduct[]>({
    queryKey: catalogKeys.brandShelf(brand, limit),
    queryFn: ({ signal }) => fetchBrandShelf(brand, limit, signal),
    staleTime: SHELF_STALE_TIME_MS,
  });
}

/**
 * Uma prateleira com mais de uma marca dentro.
 *
 * ## Por que não e uma consulta só
 *
 * O filtro de marca do backend aceita uma marca por vez — ele casa a marca
 * inteira, e não uma lista. Então são N consultas em paralelo, uma por
 * marca, cada uma com a chave e o cache que já teria se estivesse sozinha na
 * home: trocar a ordem das marcas, ou promover uma delas para prateleira
 * própria depois, não custa nenhuma ida nova ao servidor.
 *
 * ## Por que intercalado, e não emendado
 *
 * Emendando as listas, as cinco vagas da fileira sairiam todas da primeira
 * marca sempre que ela tivesse cinco produtos — e a segunda marca nunca
 * apareceria na prateleira que leva o nome dela. Intercalando, as duas
 * entram na fileira: com cinco vagas e duas marcas, três e duas.
 *
 * ## Erro parcial não apaga a prateleira
 *
 * `isError` só quando **todas** falham. Uma marca fora do ar não e motivo
 * para sumir com a fileira inteira — o cliente veria uma seção a menos sem
 * nenhum aviso, e a loja perderia a outra marca junto.
 */
export function useBrandsShelf(brands: readonly string[], limit = BRAND_SHELF_LIMIT) {
  return useQueries({
    queries: brands.map((brand) => ({
      queryKey: catalogKeys.brandShelf(brand, limit),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchBrandShelf(brand, limit, signal),
      staleTime: SHELF_STALE_TIME_MS,
    })),

    combine: (results) => ({
      data: interleave(
        results.map((result) => result.data),
        limit,
      ),
      isLoading: results.some((result) => result.isLoading),
      isError: results.length > 0 && results.every((result) => result.isError),
    }),
  });
}

/**
 * As listas alternadas entre si, até o teto: a primeira de cada, depois a
 * segunda de cada, e assim por diante.
 *
 * Uma lista que acaba antes das outras simplesmente para de contribuir — com
 * quatro de uma marca e uma de outra, as cinco vagas saem 1, 1, 1, 1 e a
 * quinta da primeira marca. Nenhuma vaga fica vazia por causa do rodizio.
 */
function interleave(lists: readonly (PublicProduct[] | undefined)[], limit: number) {
  const picked: PublicProduct[] = [];
  const longest = Math.max(0, ...lists.map((list) => list?.length ?? 0));

  for (let position = 0; position < longest && picked.length < limit; position += 1) {
    for (const list of lists) {
      const product = list?.[position];

      if (product !== undefined && picked.length < limit) {
        picked.push(product);
      }
    }
  }

  return picked;
}

/* ---- A categoria da página --------------------------------------------- */

/**
 * A categoria pelo endereço, com as subcategorias dela.
 *
 * Mesmo frescor do menu: nome e foto de categoria não mudam durante uma
 * visita. O `enabled` desliga a consulta em `/produtos` e `/busca`, que não
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
 * `GET /categories/:slug` responde 301 quando o endereço mudou de nome, e o
 * navegador segue o redirecionamento sozinho — então o corpo `MovedCategory`
 * quase nunca chega aqui. Quando chega, e tratado como ausência: a página
 * desenha o cabeçalho genérico em vez de mostrar `undefined` no título.
 */
export function asCategory(data: CategoryTree | MovedCategory | undefined): CategoryTree | null {
  return data !== undefined && 'name' in data ? data : null;
}

/* ---- O produto ---------------------------------------------------------- */

/** O mesmo minuto do resto do catálogo. */
const PRODUCT_STALE_TIME_MS = 60_000;

/**
 * O produto da página dele.
 *
 * Mesma chave e mesmo frescor da prebusca do card — e e essa igualdade que
 * torna a navegação instantanea. Quem passou o mouse pelo card antes de
 * clicar chega aqui e encontra a resposta pronta no cache, sem esqueleto e
 * sem ida a rede.
 *
 * O `enabled` protege do endereço sem slug, que não existe pela rota mas
 * existe enquanto o React Router resolve os parâmetros.
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
 * responder. Quando a página do produto abrir, ela vai pedir exatamente esta
 * chave e encontrar o dado pronto: a navegação parece instantanea porque,
 * para os dados, ela e.
 *
 * `prefetchQuery` respeita `staleTime`, então passar o mouse dez vezes pelo
 * mesmo card e uma requisição só. A promessa e descartada de propósito —
 * prebusca que falha não e erro: e só um clique que vai esperar como
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
