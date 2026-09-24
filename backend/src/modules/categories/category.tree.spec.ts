import { Types } from 'mongoose';
import { branchesOf } from './category.tree.js';
import type { Hierarchical } from './category.tree.js';

function category(name: string, order: number, parent: Hierarchical | null = null): Hierarchical {
  return {
    _id: new Types.ObjectId(),
    parentId: parent ? parent._id : null,
    order,
    name,
  };
}

describe('branchesOf', () => {
  it('aninha os filhos no pai, os dois níveis por order', () => {
    const casa = category('Casa', 1);
    const perfumes = category('Perfumes', 0);
    const importados = category('Importados', 1, perfumes);
    const arabes = category('Árabes', 0, perfumes);

    const branches = branchesOf([casa, importados, perfumes, arabes]);

    expect(branches.map((branch) => branch.parent.name)).toEqual(['Perfumes', 'Casa']);
    expect(branches[0].children.map((child) => child.name)).toEqual([
      'Árabes',
      'Importados',
    ]);
    expect(branches[1].children).toEqual([]);
  });

  it('desempata pelo nome, para a lista não dancar entre duas chamadas', () => {
    const branches = branchesOf([
      category('Velas', 0),
      category('Casa', 0),
      category('Perfumes', 0),
    ]);

    expect(branches.map((branch) => branch.parent.name)).toEqual([
      'Casa',
      'Perfumes',
      'Velas',
    ]);
  });

  it('deixa de fora o filho cujo pai não veio na lista', () => {
    // E o que faz desativar so o pai sumir com o galho inteiro do menu, em
    // vez de promover a subcategoria a categoria principal.
    const ausente = category('Perfumes', 0);
    const arabes = category('Árabes', 0, ausente);

    expect(branchesOf([arabes])).toEqual([]);
  });
});
