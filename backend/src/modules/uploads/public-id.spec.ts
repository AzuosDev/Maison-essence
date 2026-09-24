import { isImagePublicId } from '../../common/image-public-id.js';
import { buildPublicId } from './public-id.js';

describe('buildPublicId', () => {
  it('poe a foto na pasta pedida, com o nome do arquivo legível', () => {
    expect(buildPublicId('products', 'Asad Lattafa.jpg')).toMatch(
      /^maison-essence\/products\/asad-lattafa-[0-9a-f]{8}$/,
    );
  });

  it('tira acento e extensão, como o slug faz', () => {
    expect(buildPublicId('categories', 'Perfume Árabe.WEBP')).toMatch(
      /^maison-essence\/categories\/perfume-arabe-[0-9a-f]{8}$/,
    );
  });

  it('sorteia o nome inteiro quando o arquivo não tem nome aproveitável', () => {
    expect(buildPublicId('banners', '***.png')).toMatch(
      /^maison-essence\/banners\/[0-9a-f]{8}$/,
    );
    expect(buildPublicId('banners')).toMatch(/^maison-essence\/banners\/[0-9a-f]{8}$/);
  });

  it('não repete o identificador entre dois envios do mesmo arquivo', () => {
    expect(buildPublicId('products', 'foto.jpg')).not.toBe(buildPublicId('products', 'foto.jpg'));
  });

  it('gera sempre um identificador que a própria loja aceita', () => {
    const nome = 'Perfume árabe importado edição limitada de colecionador 2026 exclusivo.jpeg';

    expect(isImagePublicId(buildPublicId('products', nome))).toBe(true);
  });
});
