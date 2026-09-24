import { isApiError } from '@/lib/http';
import type { AdminCategory, AdminCategoryNode, CategoryBlockedDetails } from './admin.types';

/**
 * A árvore de categorias, como a tela a manipula.
 *
 * ## Por que a ordem do menu e uma lista plana
 *
 * O servidor guarda **um** campo `order` por categoria, e a rota de
 * reordenação grava `order = indice` para cada id que recebe. Não há "ordem
 * dentro do pai": o que existe e uma numeração única, e a árvore se forma
 * depois, agrupando por `parentId` e ordenando cada nível por `order`.
 *
 * Isso tem uma consequência prática que vale registrar: se a lista for
 * mandada em **ordem de menu** — cada pai seguido dos filhos dele —, os
 * índices resultantes ordenam corretamente os dois níveis de uma vez. Pai A
 * vira 0, os filhos dele 1 e 2, pai B vira 3; no topo, 0 vem antes de 3, e
 * dentro de A, 1 vem antes de 2. Uma lista em qualquer outra ordem embaralha
 * o menu sem que nada reclame.
 *
 * ## Arrastar move dentro do nível, e não entre níveis
 *
 * Um pai troca de lugar com outro pai; um filho troca de lugar com os irmaos
 * dele. Mudar de pai e outra operação — um `PATCH` com `parentId` —, e
 * misturar as duas num gesto só faria um arraste desatento tirar a
 * subcategoria de onde ela estava sem dizer.
 *
 * ## Tudo aqui e função pura
 *
 * A ordem do menu e o tipo de coisa que erra em silêncio: ninguém confere a
 * sequência de oito categorias olhando, e o defeito só aparece na loja, para
 * o cliente.
 */

/** A lista de ids em ordem de menu: cada pai seguido dos filhos dele. */
export function menuOrder(tree: readonly AdminCategoryNode[]): string[] {
  return tree.flatMap((parent) => [parent.id, ...parent.children.map((child) => child.id)]);
}

/**
 * Move uma categoria principal de posição, levando os filhos junto.
 *
 * Os filhos acompanham porque eles moram **dentro** do no: a árvore e o
 * modelo, e a lista plana só aparece na hora de mandar.
 */
export function moveParent(
  tree: readonly AdminCategoryNode[],
  from: number,
  to: number,
): AdminCategoryNode[] {
  return moveWithin(tree, from, to);
}

/** Move uma subcategoria entre os irmaos dela, sem sair do pai. */
export function moveChild(
  tree: readonly AdminCategoryNode[],
  parentId: string,
  from: number,
  to: number,
): AdminCategoryNode[] {
  return tree.map((parent) =>
    parent.id === parentId
      ? { ...parent, children: moveWithin(parent.children, from, to) }
      : parent,
  );
}

/** Todas as categorias, pais e filhos, numa lista só. */
export function flatten(tree: readonly AdminCategoryNode[]): AdminCategory[] {
  return tree.flatMap((parent) => [parent, ...parent.children]);
}

/** Quantas categorias existem ao todo. */
export function countCategories(tree: readonly AdminCategoryNode[]): number {
  return flatten(tree).length;
}

/**
 * As opções de "dentro de", para mover uma categoria de pai.
 *
 * Só categorias principais entram, e nunca a própria categoria: uma
 * subcategoria não pode ter filhos (o servidor recusa com
 * `NESTING_TOO_DEEP_MESSAGE`) e nada pode ser pai de si mesmo.
 *
 * Uma categoria **que já tem filhos** também não pode virar subcategoria — o
 * servidor recusa com `HAS_CHILDREN_MESSAGE` —, e quem chama trata isso
 * escondendo a opção inteira, e não filtrando a lista.
 */
export function parentOptions(
  tree: readonly AdminCategoryNode[],
  exceptId: string,
): { value: string; label: string }[] {
  return tree
    .filter((parent) => parent.id !== exceptId)
    .map((parent) => ({ value: parent.id, label: parent.name }));
}

/** A categoria tem subcategorias e por isso não pode virar subcategoria. */
export function hasChildren(tree: readonly AdminCategoryNode[], id: string): boolean {
  return tree.some((parent) => parent.id === id && parent.children.length > 0);
}

/**
 * O que impediu a exclusão, quando o servidor recusou com 409.
 *
 * Devolve `null` para qualquer outro erro — sem rede, sessão expirada, id que
 * não existe. Só o 409 desta rota carrega as contagens, e só ele merece a
 * oferta de desativar no lugar.
 */
export function blockedBy(error: unknown): CategoryBlockedDetails | null {
  if (!isApiError(error) || error.status !== 409 || error.details === null) {
    return null;
  }

  const { subcategoryCount, productCount, canDeactivate } = error.details;

  if (typeof subcategoryCount !== 'number' || typeof productCount !== 'number') {
    return null;
  }

  return { subcategoryCount, productCount, canDeactivate: canDeactivate === true };
}

function moveWithin<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);

  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }

  return next;
}
