import sharp from 'sharp';
import type { PageImage } from './pdf-geometry.js';

function toBuffer(image: Pick<PageImage, 'data'>): Buffer {
  return Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
}

/** Lado da grade do dHash. Ver o comentario da funcao para o porque de 16. */
const HASH_SIZE = 16;

/**
 * dHash de 256 bits: reduz a imagem a uma grade 17x16 em cinza e guarda, para
 * cada pixel, se ele e mais claro ou mais escuro que o vizinho da direita.
 *
 * Um dHash 8x8 (64 bits), o tamanho de manual mais comum, nao discrimina as
 * fotos deste fornecedor: os frascos de "Body Mist" da mesma linha sao
 * fotografados na mesma pose, luz e fundo, so o rotulo impresso muda — a
 * 8x8 essa diferenca de detalhe fino se perde na media e frascos
 * DIFERENTES caem a distancia zero um do outro (testado contra as 12 fotos
 * da secao Body Mist do catalogo Originais). Em 16x16 a menor distancia
 * medida entre dois frascos diferentes daquela mesma secao subiu para 13 em
 * 256 bits — o suficiente para separar "parecido" de "duplicado" sem
 * depender de reconhecer o rotulo.
 */
export async function perceptualHash(image: Pick<PageImage, 'data' | 'widthPx' | 'heightPx' | 'channels'>): Promise<bigint> {
  const grey = await sharp(toBuffer(image), {
    raw: { width: image.widthPx, height: image.heightPx, channels: image.channels },
  })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .greyscale()
    .resize(HASH_SIZE + 1, HASH_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer();

  let hash = 0n;

  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      const left = grey[y * (HASH_SIZE + 1) + x]!;
      const right = grey[y * (HASH_SIZE + 1) + x + 1]!;

      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }

  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let count = 0;

  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }

  return count;
}
