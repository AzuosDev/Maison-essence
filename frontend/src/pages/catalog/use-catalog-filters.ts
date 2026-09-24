import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  clearedFilters,
  countActiveFilters,
  filtersFromSearch,
  searchFromFilters,
  type CatalogContext,
  type CatalogFilters,
} from '@/features/catalog';

/**
 * Os filtros da vitrine, morando na barra de endereços.
 *
 * Não há `useState` de filtro em lugar nenhum desta página. A query string e
 * o estado — o único —, e os componentes só a leem e a reescrevem. Essa
 * escolha e o que entrega, de uma vez, as três coisas pedidas:
 *
 * - **A URL filtrada e compartilhável.** O que esta na tela esta no endereço,
 *   sempre, porque não existe um segundo lugar onde o estado pudesse estar.
 * - **Recarregar mantem tudo aplicado.** Não há nada a reidratar: a página
 *   nasce lendo os mesmos parâmetros que leu da última vez.
 * - **O botão de voltar funciona.** Cada mudanca de página e uma entrada no
 *   histórico, e o navegador desfaz na ordem em que o cliente fez.
 *
 * ## Quem empurra o histórico e quem substitui
 *
 * Marcar um filtro **substitui** a entrada atual. Dez ajustes na barra
 * lateral não podem virar dez passos que o cliente precise desfazer um a um
 * para voltar de onde veio — o botão de voltar tem que sair da vitrine, e
 * não passear pela história dos checkboxes.
 *
 * Mudar de página **empurra** uma entrada nova. Aí o passo e real: voltar da
 * página 3 para a 2 e o que qualquer pessoa espera.
 */

export interface CatalogFiltersState {
  filters: CatalogFilters;
  /** Quantos filtros o cliente aplicou, sem contar o que a rota impos. */
  activeCount: number;
  /** Aplica um recorte e volta para a primeira página. */
  update: (patch: Partial<CatalogFilters>) => void;
  /** Muda de página preservando os filtros. Empurra no histórico. */
  goToPage: (page: number) => void;
  /** Volta ao catálogo cheio, preservando o termo buscado e a ordem. */
  clear: () => void;
}

export function useCatalogFilters(context: CatalogContext = {}): CatalogFiltersState {
  const [search, setSearch] = useSearchParams();

  const filters = useMemo(() => filtersFromSearch(search), [search]);

  const update = useCallback(
    (patch: Partial<CatalogFilters>) => {
      // Todo filtro novo devolve o cliente a primeira página. Sem isso,
      // marcar "em estoque" enquanto se vê a página 4 pode cair numa lista
      // que agora só tem duas — e a tela fica vazia sem motivo aparente.
      setSearch(searchFromFilters({ ...filters, ...patch, page: 1 }), { replace: true });
    },
    [filters, setSearch],
  );

  const goToPage = useCallback(
    (page: number) => {
      setSearch(searchFromFilters({ ...filters, page }));
    },
    [filters, setSearch],
  );

  const clear = useCallback(() => {
    setSearch(searchFromFilters(clearedFilters(filters)), { replace: true });
  }, [filters, setSearch]);

  return {
    filters,
    activeCount: countActiveFilters(filters, context),
    update,
    goToPage,
    clear,
  };
}
