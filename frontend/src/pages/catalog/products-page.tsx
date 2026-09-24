import { ROUTES } from '@/app/routes';
import { CatalogView } from './catalog-view';

/**
 * A vitrine inteira: `/produtos`.
 *
 * Três linhas porque e só isto que a distingue das outras listagens — o
 * título e o fio de pão. Filtros, ordenação, paginação, grade e vazio são os
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
