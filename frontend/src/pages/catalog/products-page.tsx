import { ROUTES } from '@/app/routes';
import { CatalogView } from './catalog-view';

/**
 * A vitrine inteira: `/produtos`.
 *
 * Tres linhas porque e so isto que a distingue das outras listagens — o
 * titulo e o fio de pao. Filtros, ordenacao, paginacao, grade e vazio sao os
 * mesmos de `/categorias/:slug` e de `/busca`, e moram em `CatalogView`.
 */
export default function ProductsPage() {
  return (
    <CatalogView
      title="Todos os produtos"
      description="A seleção inteira da Maison Essence. Use os filtros para encontrar pela faixa de preço, pela marca ou pelo que esta pronto para sair hoje."
      breadcrumb={[{ label: 'Início', to: ROUTES.home }, { label: 'Produtos' }]}
      emptyTitle="Nenhum produto com estes filtros"
      emptyDescription="Nenhum produto da loja atende a todos os filtros escolhidos ao mesmo tempo. Tente soltar um deles."
    />
  );
}
