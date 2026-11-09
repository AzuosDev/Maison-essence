import { ROUTES } from '@/app/routes';
import { ProductGrid } from '@/components/store';
import { Container } from '@/components/ui';
import { useShelf } from '@/features/catalog';
import { CatalogEmpty } from './catalog-empty';
import { CatalogHeader } from './catalog-header';
import styles from './best-sellers-page.module.css';

/**
 * Mais vendidos: `/mais-vendidos`.
 *
 * ## Por que não e a tela das outras quatro listagens
 *
 * `/produtos`, `/pronta-entrega`, `/categorias/:slug` e `/busca` são a mesma
 * tela com contextos diferentes, porque as quatro são recortes do catálogo —
 * e o catálogo sabe filtrar e ordenar por todas elas. Esta não e um recorte:
 * o ranking sai da quantidade somada nos pedidos que viraram venda, e não do
 * cadastro do produto. Nenhuma ordem da listagem sabe calcula-lo, e inventar
 * um `?ordem=mais-vendidos` que o servidor não tem seria prometer na URL uma
 * ordenação que não existe.
 *
 * Por isso aqui não há barra de filtros nem paginação: a prateleira tem
 * começo e fim, e são as quarenta e oito posições que o ranking alcança. Quem
 * quer navegar o catálogo inteiro tem o "Ver todos os produtos" no fim.
 *
 * ## A mesma resposta da home, sem segunda ida ao servidor
 *
 * A consulta e a mesma de `useShelf('best-sellers')` que a home faz, com
 * outro limite. Quem chegou por ela vê a lista de imediato nas doze primeiras
 * posições e as demais entram quando a resposta maior chega — e quem digitou
 * o endereço direto espera uma consulta só.
 */

/** O teto do servidor para uma prateleira (`MAX_PUBLIC_PAGE_SIZE`). */
const LIMIT = 48;

export default function BestSellersPage() {
  const { data, isPending, isError } = useShelf('best-sellers', LIMIT);

  const products = data ?? [];

  return (
    <Container className={styles.page}>
      <CatalogHeader
        breadcrumb={[{ label: 'Início', to: ROUTES.home }, { label: 'Mais vendidos' }]}
        title="Mais vendidos"
        description="O que mais saiu das nossas mãos nas últimas semanas, na ordem em que vendeu."
        totalItems={isPending ? undefined : products.length}
        isLoading={isPending}
      />

      {/*
        Erro e lista vazia terminam na mesma tela, e isso e decisão.

        Para quem esta do lado de fora as duas são a mesma coisa — não há o
        que ver aqui agora — e `CatalogEmpty` não deixa a visita terminar em
        beco sem saída: ele sugere produtos. Uma faixa vermelha de erro no
        lugar diria o que deu errado e não ofereceria para onde ir.
      */}
      {!isPending && (isError || products.length === 0) ? (
        <CatalogEmpty
          title="Ainda não há um ranking de vendas"
          description="Assim que os primeiros pedidos forem saindo, os mais vendidos aparecem aqui. Enquanto isso, veja o que acabou de chegar."
        />
      ) : (
        <ProductGrid products={products} isLoading={isPending} skeletonCount={12} />
      )}
    </Container>
  );
}
