import type { UploadFolder } from '../../common/image-public-id.js';
import type { ImageUrls } from './cloudinary.url.js';

/**
 * O que o painel precisa para enviar o arquivo direto ao Cloudinary.
 *
 * `params` vai literal de proposito: sao exatamente os campos que foram
 * assinados, e o navegador deve repeti-los sem alterar nada, acrescentando so
 * `file` e `api_key`. Deixar o frontend remontar essa lista e convidar o
 * "Invalid Signature" que nao diz qual campo divergiu.
 */
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** Caminho completo da pasta de destino, so para exibicao. */
  folder: string;
  /** O identificador que a foto tera. Ja vai assinado: o navegador nao escolhe. */
  publicId: string;
  uploadUrl: string;
  params: Record<string, string | number>;
  expiresAt: string;
  /** Teto conferido pelo painel antes de enviar e pela API no confirm. */
  maxBytes: number;
  allowedFormats: readonly string[];
}

/** Uma imagem ja guardada e conferida, pronta para ser vinculada. */
export interface UploadedImage {
  publicId: string;
  folder: UploadFolder;
  format: string;
  bytes: number;
  width: number;
  height: number;
  urls: ImageUrls;
}

/** Onde uma imagem esta em uso, quando a remocao e recusada. */
export interface ImageReferences {
  products: number;
  categories: number;
  banners: number;
}
