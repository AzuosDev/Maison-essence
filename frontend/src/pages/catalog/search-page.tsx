import { useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { CatalogView } from './catalog-view';

/**
 * A busca: `/busca?q=amadeirado`.
 *
 * A mesma listagem de `/produtos`, com duas diferenças.
 *
 * O termo vem da query string e já e um filtro como os outros — quem o lê e
 * `filtersFromSearch`, dentro de `CatalogView`. Não há estado de busca
 * separado aqui: por isso a URL de uma busca filtrada também e
 * compartilhável, e `?q=oud&marca=Lattafa&estoque=1` reabre exatamente a
 * mesma tela.
 *
 * E os nomes saem com o termo realcado, para o cliente entender por que cada
 * produto apareceu. "Limpar filtros" preserva o termo: quem esta numa busca
 * quer soltar o recorte, e não voltar ao catálogo inteiro.
 */
export default function SearchPage() {
  const [search] = useSearchParams();
  const term = (search.get('q') ?? '').trim();

  return (
    <CatalogView
      title={term === '' ? 'Busca' : `Resultados para "${term}"`}
      breadcrumb={[{ label: 'Início', to: ROUTES.home }, { label: 'Busca' }]}
      highlight={term}
      emptyTitle={term === '' ? 'O que você procura?' : `Nada encontrado para "${term}"`}
      emptyDescription={
        term === ''
          ? 'Use a lupa no cabeçalho para procurar por nome ou marca.'
          : 'Tente uma palavra mais curta, procure pela marca, ou veja as sugestões abaixo.'
      }
    />
  );
}
