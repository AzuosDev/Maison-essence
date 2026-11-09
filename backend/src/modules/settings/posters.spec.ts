import { describe, expect, it } from 'vitest';
import { livePosters, unknownPosterIds } from './posters.js';

/**
 * A faixa de cartazes de coleção.
 *
 * Mesmas duas regras da fileira de atalhos — quais aparecem e em que ordem —,
 * e a mesma recusa de id desconhecido, que é o que impede uma gravação de
 * ressuscitar um cartaz que outra pessoa acabou de apagar.
 */
describe('livePosters', () => {
  it('deixa de fora o desligado e ordena pelo `order`', () => {
    const faixa = livePosters([
      { label: 'Mais vendidos', order: 1, isActive: true },
      { label: 'Guardado', order: 2, isActive: false },
      { label: "Victoria's Secret", order: 0, isActive: true },
    ]);

    expect(faixa.map((poster) => poster.label)).toEqual(["Victoria's Secret", 'Mais vendidos']);
  });

  it('devolve lista vazia quando nenhum está ligado', () => {
    // Não é caso de borda: é o que faz a home voltar a deduzir a faixa das
    // categorias em vez de desenhar meia faixa.
    expect(livePosters([{ order: 0, isActive: false }])).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const guardados = [
      { label: 'Mais vendidos', order: 1, isActive: true },
      { label: "Victoria's Secret", order: 0, isActive: true },
    ];

    livePosters(guardados);

    // `sort` ordena no lugar: sem a cópia, ordenar para a vitrine
    // reordenaria o array do documento do Mongoose.
    expect(guardados.map((poster) => poster.label)).toEqual([
      'Mais vendidos',
      "Victoria's Secret",
    ]);
  });
});

describe('unknownPosterIds', () => {
  it('aponta o id que não é de cartaz nenhum', () => {
    expect(unknownPosterIds([{ id: 'a' }, { id: 'sumiu' }], ['a', 'b'])).toEqual(['sumiu']);
  });

  it('deixa passar o cartaz sem id, que é o novo', () => {
    expect(unknownPosterIds([{}, { id: 'a' }], ['a'])).toEqual([]);
  });
});
