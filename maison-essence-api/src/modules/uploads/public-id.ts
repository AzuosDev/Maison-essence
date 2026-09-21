import { randomBytes } from 'node:crypto';
import type { UploadFolder } from '../../common/image-public-id.js';
import { UPLOAD_FOLDERS } from '../../common/image-public-id.js';
import { slugify } from '../../database/slug.js';

/** Quanto do nome do arquivo entra no identificador. */
const MAX_NAME_SLUG_LENGTH = 60;

/**
 * Monta o identificador da foto: pasta, nome legivel e sorteio.
 *
 * O nome vem do arquivo que a dona escolheu, passado pelo mesmo `slugify` do
 * resto do projeto — `Asad Lattafa.jpg` vira `asad-lattafa-9f3a1c2b`, que ela
 * reconhece na biblioteca do Cloudinary. Identificador so sorteado seria
 * unico e ilegivel, e a conta viraria um monte de hexadecimal.
 *
 * O sorteio no fim garante que duas fotos de mesmo nome nao se sobrescrevam —
 * e, como o `publicId` inteiro vai assinado, tambem impede que uma assinatura
 * reaproveitada substitua uma foto ja publicada.
 */
export function buildPublicId(folder: UploadFolder, filename?: string): string {
  const name = slugify(stripExtension(filename ?? ''))
    .slice(0, MAX_NAME_SLUG_LENGTH)
    .replace(/-+$/, '');
  const suffix = randomBytes(4).toString('hex');

  return `${UPLOAD_FOLDERS[folder]}/${name.length > 0 ? `${name}-${suffix}` : suffix}`;
}

/** `asad.jpg` vira `asad`; `asad.v2` fica como esta se nao parecer extensao. */
function stripExtension(filename: string): string {
  return filename.replace(/\.[a-z0-9]{1,5}$/i, '');
}
