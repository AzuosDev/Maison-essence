import sharp from 'sharp';
import { OUTPUT_ASPECT_RATIO, OUTPUT_MAX_SIDE_PX, OUTPUT_WEBP_QUALITY } from './config.js';
import type { PageImage } from './pdf-geometry.js';

const WHITE = { r: 255, g: 255, b: 255 };

/**
 * Recorta a moldura de fundo uniforme, encaixa em 3:4 com sobra branca e
 * grava em WebP — o formato do card da loja (ver item 5 do pedido).
 *
 * A ordem importa: primeiro achata a transparencia sobre branco (as fotos
 * RGBA do catalogo tem fundo transparente, nao branco de verdade — aparar
 * antes disso compararia contra pixels arbitrarios por baixo do alfa), so
 * depois apara a moldura, so depois redimensiona. O `fit: 'contain'` do
 * `sharp` faz redimensionar e preencher branco no mesmo passo: a imagem
 * nunca ultrapassa 1200px no lado maior e o canvas final e sempre 3:4.
 */
export async function processProductImage(image: PageImage): Promise<Buffer> {
  const raw = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const canvasHeight = OUTPUT_MAX_SIDE_PX;
  const canvasWidth = Math.round(canvasHeight * OUTPUT_ASPECT_RATIO);

  return sharp(raw, { raw: { width: image.widthPx, height: image.heightPx, channels: image.channels } })
    .flatten({ background: WHITE })
    .trim({ background: '#ffffff', threshold: 12 })
    .resize(canvasWidth, canvasHeight, {
      fit: 'contain',
      background: WHITE,
      withoutEnlargement: true,
    })
    .webp({ quality: OUTPUT_WEBP_QUALITY })
    .toBuffer();
}
