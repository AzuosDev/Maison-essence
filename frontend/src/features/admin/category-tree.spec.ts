import { expect, test } from 'vitest';
import { ApiError } from '@/lib/http';
import type { AdminCategory, AdminCategoryNode } from './admin.types';
import {
  blockedBy,
  countCategories,
  flatten,
  hasChildren,
  menuOrder,
  moveChild,
  moveParent,
  parentOptions,
} from './category-tree';

/**
 * A arvore de categorias.
 *
 * O que erra em silencio aqui e a **ordem**: ninguem confere a sequencia de
 * oito categorias olhando, e o defeito so aparece na loja, para o cliente.
 * Por isso a maioria destes casos e sobre a lista plana que vai para o
 * servidor — ela e quem determina o menu, e ela nao aparece em tela nenhuma.
 */

function category(patch: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: 'c1',
    name: 'Masculino',
    slug: 'masculino',
    previousSlugs: [],
    parentId: null,
    image: '',
    order: 0,
    isActive: true,
    productCount: 0,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

function node(id: string, name: string, children: AdminCategory[] = []): AdminCategoryNode {
  return { ...category({ id, name }), children };
}

/** Masculino (Amadeirado, Citrico), Feminino, Arabes. */
function tree(): AdminCategoryNode[] {
  return [
    node('m', 'Masculino', [
      category({ id: 'm1', name: 'Amadeirado', parentId: 'm' }),
      category({ id: 'm2', name: 'Cítrico', parentId: 'm' }),
    ]),
    node('f', 'Feminino'),
    node('a', 'Árabes'),
  ];
}

/* ---- A ordem do menu ------------------------------------------------------- */

test('a lista plana sai em ordem de menu: cada pai seguido dos filhos', () => {
  // E esta ordem que faz o servidor gravar indices que ordenam os dois niveis
  // de uma vez. Qualquer outra embaralha o menu sem que nada reclame.
  expect(menuOrder(tree())).toEqual(['m', 'm1', 'm2', 'f', 'a']);
});

test('mover um pai leva os filhos junto', () => {
  const moved = moveParent(tree(), 0, 2);

  expect(moved.map((parent) => parent.id)).toEqual(['f', 'a', 'm']);
  // Os filhos moram dentro do no: eles acompanham sem que ninguem os mova.
  expect(menuOrder(moved)).toEqual(['f', 'a', 'm', 'm1', 'm2']);
});

test('mover um filho não sai do pai dele', () => {
  const moved = moveChild(tree(), 'm', 0, 1);

  expect(menuOrder(moved)).toEqual(['m', 'm2', 'm1', 'f', 'a']);
});

test('mover um filho não mexe nos outros pais', () => {
  const moved = moveChild(tree(), 'm', 0, 1);

  expect(moved.map((parent) => parent.id)).toEqual(['m', 'f', 'a']);
});

test('um movimento impossível devolve a arvore como esta', () => {
  expect(menuOrder(moveParent(tree(), 0, 9))).toEqual(menuOrder(tree()));
  expect(menuOrder(moveParent(tree(), -1, 0))).toEqual(menuOrder(tree()));
  expect(menuOrder(moveChild(tree(), 'm', 0, 0))).toEqual(menuOrder(tree()));
});

test('mover num pai que não existe não faz nada', () => {
  expect(menuOrder(moveChild(tree(), 'inexistente', 0, 1))).toEqual(menuOrder(tree()));
});

/* ---- Contar e achatar ------------------------------------------------------- */

test('a contagem soma pais e filhos', () => {
  expect(countCategories(tree())).toBe(5);
  expect(countCategories([])).toBe(0);
});

test('achatar traz os dois níveis', () => {
  expect(flatten(tree()).map((item) => item.id)).toEqual(['m', 'm1', 'm2', 'f', 'a']);
});

/* ---- Quem pode ser pai ------------------------------------------------------- */

test('só categorias principais podem ser pai', () => {
  // Uma subcategoria nao pode ter filhos: o servidor recusa com
  // `NESTING_TOO_DEEP_MESSAGE`. `m1` e `m2` nao entram na lista.
  expect(parentOptions(tree(), '').map((option) => option.value)).toEqual(['m', 'f', 'a']);
});

test('uma categoria nunca aparece como pai de si mesma', () => {
  expect(parentOptions(tree(), 'm').map((option) => option.value)).toEqual(['f', 'a']);
});

test('quem tem filhos não pode virar subcategoria', () => {
  expect(hasChildren(tree(), 'm')).toBe(true);
  expect(hasChildren(tree(), 'f')).toBe(false);
  // Um filho nao esta no primeiro nivel, entao a pergunta nao se aplica a ele.
  expect(hasChildren(tree(), 'm1')).toBe(false);
});

/* ---- O que impede a exclusao -------------------------------------------------- */

function conflict(details: Record<string, unknown>): ApiError {
  return new ApiError(409, ['Não da para excluir.'], '/admin/categories/m', {
    statusCode: 409,
    message: 'Não da para excluir.',
    error: 'Conflict',
    details,
    timestamp: '2026-09-23T12:00:00.000Z',
    path: '/admin/categories/m',
  });
}

test('o 409 de exclusão devolve as contagens', () => {
  const blocked = blockedBy(
    conflict({ subcategoryCount: 2, productCount: 0, canDeactivate: true }),
  );

  expect(blocked).toEqual({ subcategoryCount: 2, productCount: 0, canDeactivate: true });
});

test('qualquer outro erro não vira oferta de desativar', () => {
  // Sem rede, sessao expirada, id que nao existe: nenhum deles carrega
  // contagem, e oferecer "desative no lugar" ali seria responder outra coisa.
  expect(blockedBy(new Error('sem rede'))).toBeNull();
  expect(blockedBy(conflict({}))).toBeNull();
  expect(
    blockedBy(new ApiError(404, ['Categoria não encontrada.'], '/admin/categories/x', null)),
  ).toBeNull();
});
