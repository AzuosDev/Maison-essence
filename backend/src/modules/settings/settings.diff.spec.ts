import { MAX_AUDIT_TEXT_LENGTH, diffOf } from './settings.diff.js';

describe('diffOf', () => {
  it('nao registra nada quando nada mudou', () => {
    const snapshot = { storeName: 'Maison Essence', socialLinks: { instagram: '@maison' } };

    expect(diffOf(snapshot, { ...snapshot, socialLinks: { instagram: '@maison' } })).toEqual({});
  });

  it('registra o campo que mudou, com o valor de antes e o de depois', () => {
    const changes = diffOf(
      { whatsappNumber: '5588999999999' },
      { whatsappNumber: '5588988888888' },
    );

    expect(changes).toEqual({
      whatsappNumber: { from: '5588999999999', to: '5588988888888' },
    });
  });

  it('desce por caminho nos blocos aninhados', () => {
    const changes = diffOf(
      { pickupAddress: { city: 'Sobral', state: 'CE' } },
      { pickupAddress: { city: 'Fortaleza', state: 'CE' } },
    );

    expect(changes).toEqual({ 'pickupAddress.city': { from: 'Sobral', to: 'Fortaleza' } });
  });

  it('registra banner criado e banner removido pelo id, em uma linha cada', () => {
    const changes = diffOf(
      { banners: { aaa: { title: 'Natal' } } },
      { banners: { bbb: { title: 'Ano novo' } } },
    );

    // Banner que nasce ou some entra inteiro, e nao um campo por linha: dez
    // linhas "de nada para alguma coisa" escondem o que de fato aconteceu.
    expect(changes).toEqual({
      'banners.aaa': { from: { title: 'Natal' }, to: undefined },
      'banners.bbb': { from: undefined, to: { title: 'Ano novo' } },
    });
  });

  it('desce por campo no banner que ja existia', () => {
    const changes = diffOf(
      { banners: { aaa: { title: 'Natal', order: 0 } } },
      { banners: { aaa: { title: 'Natal', order: 2 } } },
    );

    expect(changes).toEqual({ 'banners.aaa.order': { from: 0, to: 2 } });
  });

  it('corta texto longo em vez de guardar a pagina inteira no log', () => {
    const changes = diffOf({ content: '' }, { content: 'a'.repeat(500) });
    const registrado = changes.content.to as string;

    expect(registrado).toContain('(+380 caracteres)');
    expect(registrado.length).toBeLessThan(MAX_AUDIT_TEXT_LENGTH + 30);
  });

  it('compara array como valor unico: a ordem faz parte do que mudou', () => {
    expect(diffOf({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toEqual({});
    expect(diffOf({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toEqual({
      tags: { from: ['a', 'b'], to: ['b', 'a'] },
    });
  });
});
