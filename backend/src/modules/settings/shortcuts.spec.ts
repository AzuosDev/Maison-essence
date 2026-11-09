import { describe, expect, it } from 'vitest';
import { liveShortcuts, unknownShortcutIds } from './shortcuts.js';

/**
 * A fileira de atalhos da home.
 *
 * Duas regras, e as duas decidem o que a cliente vê na primeira tela: quais
 * círculos aparecem, e em que ordem. A terceira coisa coberta aqui é a
 * recusa de id desconhecido, que é o que impede uma gravação de ressuscitar
 * um atalho que outra pessoa acabou de apagar.
 */
describe('liveShortcuts', () => {
  it('deixa de fora o desligado e ordena pelo `order`', () => {
    const fileira = liveShortcuts([
      { label: 'Masculino', order: 2, isActive: true },
      { label: 'Guardado', order: 1, isActive: false },
      { label: 'Feminino', order: 0, isActive: true },
    ]);

    expect(fileira.map((shortcut) => shortcut.label)).toEqual(['Feminino', 'Masculino']);
  });

  it('devolve lista vazia quando nenhum está ligado', () => {
    // Não é caso de borda: é o que faz a home voltar às categorias-raiz em
    // vez de desenhar uma fileira vazia.
    expect(liveShortcuts([{ order: 0, isActive: false }])).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const guardados = [
      { label: 'Masculino', order: 2, isActive: true },
      { label: 'Feminino', order: 0, isActive: true },
    ];

    liveShortcuts(guardados);

    // `sort` ordena no lugar: sem a cópia, ordenar para a vitrine
    // reordenaria o array do documento do Mongoose.
    expect(guardados.map((shortcut) => shortcut.label)).toEqual(['Masculino', 'Feminino']);
  });
});

describe('unknownShortcutIds', () => {
  it('aponta o id que não é de atalho nenhum', () => {
    expect(unknownShortcutIds([{ id: 'a' }, { id: 'z' }], ['a', 'b'])).toEqual(['z']);
  });

  it('atalho sem id é novo, e não desconhecido', () => {
    expect(unknownShortcutIds([{}, { id: 'a' }], ['a'])).toEqual([]);
  });
});
