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
 * Os filtros da vitrine, morando na barra de enderecos.
 *
 * Nao ha `useState` de filtro em lugar nenhum desta pagina. A query string e
 * o estado — o unico —, e os componentes so a leem e a reescrevem. Essa
 * escolha e o que entrega, de uma vez, as tres coisas pedidas:
 *
 * - **A URL filtrada e compartilhavel.** O que esta na tela esta no endereco,
 *   sempre, porque nao existe um segundo lugar onde o estado pudesse estar.
 * - **Recarregar mantem tudo aplicado.** Nao ha nada a reidratar: a pagina
 *   nasce lendo os mesmos parametros que leu da ultima vez.
 * - **O botao de voltar funciona.** Cada mudanca de pagina e uma entrada no
 *   historico, e o navegador desfaz na ordem em que o cliente fez.
 *
 * ## Quem empurra o historico e quem substitui
 *
 * Marcar um filtro **substitui** a entrada atual. Dez ajustes na barra
 * lateral nao podem virar dez passos que o cliente precise desfazer um a um
 * para voltar de onde veio — o botao de voltar tem que sair da vitrine, e
 * nao passear pela historia dos checkboxes.
 *
 * Mudar de pagina **empurra** uma entrada nova. Ai o passo e real: voltar da
 * pagina 3 para a 2 e o que qualquer pessoa espera.
 */

export interface CatalogFiltersState {
  filters: CatalogFilters;
  /** Quantos filtros o cliente aplicou, sem contar o que a rota impos. */
  activeCount: number;
  /** Aplica um recorte e volta para a primeira pagina. */
  update: (patch: Partial<CatalogFilters>) => void;
  /** Muda de pagina preservando os filtros. Empurra no historico. */
  goToPage: (page: number) => void;
  /** Volta ao catalogo cheio, preservando o termo buscado e a ordem. */
  clear: () => void;
}

export function useCatalogFilters(context: CatalogContext = {}): CatalogFiltersState {
  const [search, setSearch] = useSearchParams();

  const filters = useMemo(() => filtersFromSearch(search), [search]);

  const update = useCallback(
    (patch: Partial<CatalogFilters>) => {
      // Todo filtro novo devolve o cliente a primeira pagina. Sem isso,
      // marcar "em estoque" enquanto se ve a pagina 4 pode cair numa lista
      // que agora so tem duas — e a tela fica vazia sem motivo aparente.
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
