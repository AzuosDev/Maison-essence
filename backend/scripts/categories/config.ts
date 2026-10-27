import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');

/** De onde saem as fotos. O nome de cada arquivo e o slug da categoria. */
export const ART_DIR = resolve(HERE, 'art');

/**
 * A pasta da conta do Cloudinary.
 *
 * Separada de `products` e de `banners` pelo mesmo motivo que elas sao
 * separadas entre si: o ciclo de vida e outro. Foto de categoria troca quando
 * a arvore muda, que e raro, e some junto com a categoria — nao acompanha
 * produto nem campanha.
 */
export const CLOUDINARY_CATEGORIES_FOLDER = 'maison-essence/categories';
