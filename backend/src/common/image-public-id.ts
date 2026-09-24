import { Matches } from 'class-validator';

/**
 * A identidade de uma imagem no sistema, em um lugar so.
 *
 * O banco guarda o `publicId` do Cloudinary e nunca a URL completa: trocar de
 * conta, de CDN ou de transformacao depois nao exige migrar dado nenhum — a
 * URL e montada na leitura, por `cloudinary.url.ts`.
 *
 * O prefixo de pasta nao e organizacao: e autorizacao. Todo `publicId` que
 * entra no banco precisa estar dentro de uma das pastas abaixo, e e a
 * assinatura de upload que garante que so essas pastas podem ser escritas.
 * Sem essa checagem, qualquer string — inclusive o `publicId` da conta de um
 * terceiro — poderia ser gravada como foto de um produto.
 *
 * Por isso a regra mora em `common/` e nao no modulo de uploads: quem grava
 * imagem (produtos, categorias, banners) precisa dela tanto quanto quem faz o
 * upload.
 */

/** Raiz da conta do Cloudinary reservada a loja. */
export const UPLOAD_ROOT = 'maison-essence';

/** As unicas pastas em que o painel pode escrever. */
export const UPLOAD_FOLDERS = {
  products: `${UPLOAD_ROOT}/products`,
  categories: `${UPLOAD_ROOT}/categories`,
  banners: `${UPLOAD_ROOT}/banners`,
} as const;

export type UploadFolder = keyof typeof UPLOAD_FOLDERS;

export const UPLOAD_FOLDER_KEYS = Object.keys(UPLOAD_FOLDERS) as UploadFolder[];

/** Quanto do nome, depois da pasta, cabe em um `publicId`. */
export const MAX_PUBLIC_ID_NAME_LENGTH = 120;

/**
 * `maison-essence/products/asad-lattafa-9f3a1c`.
 *
 * O conjunto de caracteres e o mesmo do slug — minusculas, digitos e hifen —
 * porque o `publicId` vira caminho de URL. Ponto e barra ficam de fora de
 * proposito: sao eles que permitiriam um `../` subir para fora da pasta.
 */
const PUBLIC_ID_BODY = `${UPLOAD_ROOT}/(?:${UPLOAD_FOLDER_KEYS.join('|')})/[a-z0-9][a-z0-9-]{0,${MAX_PUBLIC_ID_NAME_LENGTH - 1}}`;

export const IMAGE_PUBLIC_ID_PATTERN = new RegExp(`^${PUBLIC_ID_BODY}$`);

/** Mesma regra, aceitando vazio: campo de imagem unica sem foto escolhida. */
export const OPTIONAL_IMAGE_PUBLIC_ID_PATTERN = new RegExp(`^(?:${PUBLIC_ID_BODY})?$`);

export const IMAGE_PUBLIC_ID_MESSAGE =
  'imagem inválida: use o identificador devolvido pelo upload do painel';

export function isImagePublicId(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_PUBLIC_ID_PATTERN.test(value);
}

/** De qual pasta a imagem e, ou `null` quando o `publicId` nao e da loja. */
export function folderOf(publicId: string): UploadFolder | null {
  if (!isImagePublicId(publicId)) {
    return null;
  }

  const key = publicId.slice(UPLOAD_ROOT.length + 1, publicId.lastIndexOf('/'));

  return UPLOAD_FOLDER_KEYS.find((folder) => folder === key) ?? null;
}

/** Valida um campo de imagem obrigatorio. `each: true` para array de fotos. */
export const IsImagePublicId = (options: { each?: boolean } = {}): PropertyDecorator =>
  Matches(IMAGE_PUBLIC_ID_PATTERN, { ...options, message: IMAGE_PUBLIC_ID_MESSAGE });

/** Valida um campo de imagem que aceita ficar vazio. */
export const IsOptionalImagePublicId = (): PropertyDecorator =>
  Matches(OPTIONAL_IMAGE_PUBLIC_ID_PATTERN, { message: IMAGE_PUBLIC_ID_MESSAGE });
