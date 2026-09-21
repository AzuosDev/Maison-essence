import type { ImagePreset } from './uploads.constants.js';
import { IMAGE_PRESETS, IMAGE_WIDTHS } from './uploads.constants.js';

/**
 * Monta a URL de entrega de uma imagem a partir do `publicId`.
 *
 * Funcao pura, sem nada do Nest, de proposito: o frontend usa exatamente esta
 * regra para montar `src` e `srcset`, e as duas pontas precisam concordar.
 * Se divergirem, o navegador baixa uma variante que ninguem mais pede e o
 * cache do Cloudinary deixa de ajudar.
 *
 * As tres transformacoes fixas:
 *
 * - `f_auto` entrega webp (ou avif) para quem suporta e jpg para o resto,
 *   decidindo pelo `Accept` do navegador — e o que corta o peso da pagina
 *   sem guardar varias copias da foto;
 * - `q_auto` escolhe a compressao pelo conteudo da imagem;
 * - `c_limit` com a largura do contexto so reduz, nunca amplia: foto pequena
 *   nao vira borrao esticado.
 */
export function imageUrl(cloudName: string, publicId: string, preset: ImagePreset): string {
  const transformation = `f_auto,q_auto,c_limit,w_${IMAGE_WIDTHS[preset]}`;

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}

export type ImageUrls = Record<ImagePreset, string>;

/** As tres URLs de uma vez, do jeito que a resposta da API as entrega. */
export function imageUrls(cloudName: string, publicId: string): ImageUrls {
  return Object.fromEntries(
    IMAGE_PRESETS.map((preset) => [preset, imageUrl(cloudName, publicId, preset)]),
  ) as ImageUrls;
}
