import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');

/** De onde saem os arquivos de arte. */
export const ART_DIR = resolve(HERE, 'art');

/**
 * A pasta da conta do Cloudinary.
 *
 * Separada de `maison-essence/products` porque o ciclo de vida e outro: foto
 * de produto acompanha o produto, e arte de banner e campanha — entra, fica
 * um mes, sai. Misturar as duas numa pasta so faria a limpeza de uma delas
 * exigir conferir nome por nome.
 */
export const CLOUDINARY_BANNERS_FOLDER = 'maison-essence/banners';
