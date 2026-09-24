import { folderOf, isImagePublicId } from './image-public-id.js';

describe('isImagePublicId', () => {
  it('aceita identificador das pastas da loja', () => {
    expect(isImagePublicId('maison-essence/products/asad-9f3a1c2b')).toBe(true);
    expect(isImagePublicId('maison-essence/categories/perfumes-11aa')).toBe(true);
    expect(isImagePublicId('maison-essence/banners/natal-2026-7f0c')).toBe(true);
  });

  it('recusa pasta que não e da loja', () => {
    expect(isImagePublicId('maison-essence/recibos/nota-1')).toBe(false);
    expect(isImagePublicId('outra-conta/products/asad')).toBe(false);
  });

  it('recusa a foto na raiz, sem pasta nenhuma', () => {
    expect(isImagePublicId('asad')).toBe(false);
    expect(isImagePublicId('maison-essence/asad')).toBe(false);
  });

  it('recusa caminho que tenta subir de pasta', () => {
    // O ponto fica fora do conjunto de caracteres justamente por isso.
    expect(isImagePublicId('maison-essence/products/../../evil')).toBe(false);
  });

  it('recusa subpasta inventada dentro de uma pasta permitida', () => {
    expect(isImagePublicId('maison-essence/products/sub/asad')).toBe(false);
  });

  it('recusa o que nem string e', () => {
    expect(isImagePublicId(undefined)).toBe(false);
    expect(isImagePublicId(42)).toBe(false);
  });
});

describe('folderOf', () => {
  it('diz de qual pasta a imagem e', () => {
    expect(folderOf('maison-essence/banners/natal-7f0c')).toBe('banners');
  });

  it('devolve null para identificador de fora', () => {
    expect(folderOf('outra-conta/products/asad')).toBeNull();
  });
});
