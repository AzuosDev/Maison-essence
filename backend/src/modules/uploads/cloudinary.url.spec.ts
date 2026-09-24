import { imageUrl, imageUrls } from './cloudinary.url.js';

const PUBLIC_ID = 'maison-essence/products/asad-9f3a1c2b';

describe('imageUrl', () => {
  it('monta a URL do card com f_auto, q_auto e a largura do contexto', () => {
    expect(imageUrl('maison-test', PUBLIC_ID, 'card')).toBe(
      `https://res.cloudinary.com/maison-test/image/upload/f_auto,q_auto,c_limit,w_600/${PUBLIC_ID}`,
    );
  });

  it('usa a largura de cada preset', () => {
    expect(imageUrl('maison-test', PUBLIC_ID, 'thumb')).toContain('w_400');
    expect(imageUrl('maison-test', PUBLIC_ID, 'detail')).toContain('w_1200');
  });

  /**
   * `f_auto` e o que entrega webp para quem suporta e jpg para o resto,
   * decidindo pelo cabeçalho `Accept` do navegador. Sem ele, a loja serviria
   * o formato original para todo mundo.
   */
  it('deixa o formato a cargo do navegador, via f_auto', () => {
    expect(imageUrl('maison-test', PUBLIC_ID, 'card')).toContain('f_auto');
  });
});

describe('imageUrls', () => {
  it('devolve os três presets de uma vez', () => {
    expect(Object.keys(imageUrls('maison-test', PUBLIC_ID))).toEqual([
      'thumb',
      'card',
      'detail',
    ]);
  });
});
