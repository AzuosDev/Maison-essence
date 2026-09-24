import { useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import type { BreadcrumbItem } from '@/components/ui';
import { asCategory, useCategory, useCategoryTree, type CategoryTree } from '@/features/catalog';
import { CatalogView } from './catalog-view';
import { SubcategoryChips } from './subcategory-chips';

/**
 * Uma categoria: `/categorias/:slug`.
 *
 * ## Duas consultas, e cada uma tem o seu papel
 *
 * `useCategory` responde **o que e esta página**: o nome do título e as
 * filhas. E a única que sabe lidar com endereço renomeado — o backend
 * responde 301 e o navegador segue sozinho, então um link antigo que
 * circulou no WhatsApp continua abrindo a categoria certa.
 *
 * `useCategoryTree` responde **onde ela fica**: quem e a mãe, quais são as
 * irmas. E a mesma árvore que o menu do cabeçalho já carregou, com meia hora
 * de frescor — então o fio de pão e as pílulas aparecem sem nenhuma ida
 * extra a rede, e sem esqueleto.
 *
 * ## A descrição
 *
 * Não há. O documento de categoria do backend tem nome, foto, ordem e pai —
 * e nenhum campo de texto. O cabeçalho já sabe desenhar sem ele e aceita a
 * descrição no dia em que a API passar a mandar uma; até lá, escrever o
 * texto aqui no frontend significaria uma publicação a cada ajuste de copy,
 * que e justamente o que esta loja evita.
 */
export default function CategoryPage() {
  const { slug = '' } = useParams();

  const { data, isPending } = useCategory(slug);
  const { data: tree } = useCategoryTree();

  const category = asCategory(data);
  const branch = branchFor(tree, slug);

  const title = category?.name ?? 'Categoria';

  return (
    <CatalogView
      title={title}
      breadcrumb={breadcrumbFor(branch, slug, title)}
      context={{ category: slug }}
      isTitleLoading={isPending}
      chips={
        branch === null ? null : (
          <SubcategoryChips
            parent={branch}
            // A lista de irmas sai da mãe, e não da categoria aberta: numa
            // subcategoria, o cliente precisa ver as outras subcategorias
            // para pular de uma para a outra sem voltar antes.
            items={branch.children}
            activeSlug={slug}
          />
        )
      }
      emptyTitle="Nenhum produto nesta categoria"
      emptyDescription="Ou os filtros estreitaram demais, ou esta categoria ainda não tem produto publicado."
    />
  );
}

/**
 * O galho da árvore em que este slug esta: como mãe ou como filha.
 *
 * Devolve sempre a **mãe**, porque e dela que saem tanto o fio de pão quanto
 * a faixa de pílulas. `null` quando o slug não esta na árvore — o caso de um
 * endereço antigo, em que a listagem continua certa (o backend resolve o
 * slug renomeado) e o que falta e só a navegação lateral.
 */
function branchFor(tree: CategoryTree[] | undefined, slug: string): CategoryTree | null {
  if (tree === undefined || slug === '') {
    return null;
  }

  return (
    tree.find((root) => root.slug === slug || root.children.some((kid) => kid.slug === slug)) ??
    null
  );
}

function breadcrumbFor(branch: CategoryTree | null, slug: string, title: string): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [{ label: 'Início', to: ROUTES.home }];

  // Numa subcategoria, a mãe entra no meio do caminho: "Início / Masculino /
  // Amadeirados". Numa categoria raiz, `branch` e a própria página e seria
  // um degrau repetido.
  if (branch !== null && branch.slug !== slug) {
    trail.push({ label: branch.name, to: ROUTES.category(branch.slug) });
  }

  trail.push({ label: title });

  return trail;
}
