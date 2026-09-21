import type { CategoryBranch } from './category.tree.js';
import type { CategoryDocument } from './schemas/category.schema.js';

/** Categoria como o painel a ve. */
export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  /** Enderecos antigos que ainda redirecionam para este. */
  previousSlugs: string[];
  parentId: string | null;
  image: string;
  order: number;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Categoria como a vitrine a ve: so o que o menu precisa desenhar.
 *
 * Nao e a mesma coisa que o admin recebe. `previousSlugs` e o historico de
 * renomeacoes da dona e nao tem por que trafegar em toda abertura da loja.
 */
export interface PublicCategoryView {
  id: string;
  name: string;
  slug: string;
  image: string;
  /** Produtos ativos vinculados. No pai, ja somados os das subcategorias. */
  productCount: number;
}

/** Um nivel de aninhamento, e so um: subcategoria nao tem filhos. */
export type WithChildren<T> = T & { children: T[] };

/** Quantos produtos ativos cada categoria tem, indexado pelo id em hexadecimal. */
export type ProductCounts = ReadonlyMap<string, number>;

export function toCategoryTree(
  branches: readonly CategoryBranch<CategoryDocument>[],
  counts: ProductCounts,
): WithChildren<CategoryView>[] {
  return branches.map(({ parent, children }) => ({
    ...toCategoryView(parent, rollUp(parent, children, counts)),
    children: children.map((child) => toCategoryView(child, directCount(child, counts))),
  }));
}

export function toPublicCategoryTree(
  branches: readonly CategoryBranch<CategoryDocument>[],
  counts: ProductCounts,
): WithChildren<PublicCategoryView>[] {
  return branches.map(({ parent, children }) => ({
    ...toPublicCategoryView(parent, rollUp(parent, children, counts)),
    children: children.map((child) => toPublicCategoryView(child, directCount(child, counts))),
  }));
}

export function toCategoryView(category: CategoryDocument, productCount: number): CategoryView {
  return {
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
    previousSlugs: [...category.previousSlugs],
    parentId: category.parentId?.toHexString() ?? null,
    image: category.image,
    order: category.order,
    isActive: category.isActive,
    productCount,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function toPublicCategoryView(
  category: CategoryDocument,
  productCount: number,
): PublicCategoryView {
  return {
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
    image: category.image,
    productCount,
  };
}

export function directCount(category: CategoryDocument, counts: ProductCounts): number {
  return counts.get(category._id.toHexString()) ?? 0;
}

/**
 * Contagem do pai: a dele mais a dos filhos.
 *
 * O menu mostra "Perfumes (12)" e a dona costuma cadastrar o produto so na
 * subcategoria; sem somar, o pai apareceria zerado com doze produtos embaixo.
 * Produto cadastrado ao mesmo tempo no pai e em um filho dele conta duas
 * vezes — e um cadastro redundante, raro, e o preco de fazer a conta em uma
 * agregacao so.
 */
function rollUp(
  parent: CategoryDocument,
  children: readonly CategoryDocument[],
  counts: ProductCounts,
): number {
  return children.reduce(
    (total, child) => total + directCount(child, counts),
    directCount(parent, counts),
  );
}
