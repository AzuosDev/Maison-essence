import type { Types } from 'mongoose';

/** O minimo que a montagem da arvore precisa enxergar de uma categoria. */
export interface Hierarchical {
  _id: Types.ObjectId;
  parentId: Types.ObjectId | null;
  order: number;
  name: string;
}

/** Um pai com os seus filhos, ja na ordem em que o menu os desenha. */
export interface CategoryBranch<T> {
  parent: T;
  children: T[];
}

/**
 * Agrupa a lista plana em pais e filhos, ordenando os dois niveis por `order`.
 *
 * Filho cujo pai nao esta na lista recebida fica de fora. E isso que faz o
 * galho inteiro sumir do menu quando a dona desativa so o pai — sem precisar
 * desativar cada subcategoria na mao, e sem deixar uma subcategoria orfa
 * aparecendo na raiz do menu como se fosse uma categoria principal.
 */
export function branchesOf<T extends Hierarchical>(
  categories: readonly T[],
): CategoryBranch<T>[] {
  const childrenByParent = new Map<string, T[]>();

  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }

    const key = category.parentId.toHexString();
    const siblings = childrenByParent.get(key);

    if (siblings) {
      siblings.push(category);
    } else {
      childrenByParent.set(key, [category]);
    }
  }

  return categories
    .filter((category) => !category.parentId)
    .sort(byMenuPosition)
    .map((parent) => ({
      parent,
      children: (childrenByParent.get(parent._id.toHexString()) ?? []).sort(byMenuPosition),
    }));
}

/**
 * Menor `order` primeiro. O empate resolve pelo nome para a lista nao dancar
 * entre duas chamadas: categoria recem-criada nasce com `order: 0`, igual as
 * outras, ate a primeira reordenacao.
 */
function byMenuPosition(a: Hierarchical, b: Hierarchical): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'pt-BR');
}
