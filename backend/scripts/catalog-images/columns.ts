import type { TextBlock } from './text-blocks.js';

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Agrupa itens em colunas pelo centro horizontal.
 *
 * A grade dos catalogos tem 3 colunas na maioria das paginas, mas algumas tem
 * 2 ou 1 (a ultima linha de uma secao, por exemplo). Em vez de supor sempre 3,
 * ordena os centros e corta onde o vao entre um item e o proximo passa de
 * 12% da largura da pagina — o que sobra sao as colunas de verdade, sejam
 * quantas forem.
 */
export function clusterColumns<T extends Box>(items: readonly T[], pageWidth: number): number[] {
  if (items.length === 0) {
    return [];
  }

  const centers = items.map((item, index) => ({ index, center: (item.x0 + item.x1) / 2 }));
  const sorted = [...centers].sort((a, b) => a.center - b.center);
  const gapThreshold = pageWidth * 0.12;

  const columnOf = new Array<number>(items.length);
  let column = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i]!.center - sorted[i - 1]!.center > gapThreshold) {
      column += 1;
    }

    columnOf[sorted[i]!.index] = column;
  }

  return columnOf;
}

export interface LabelMatch {
  imageIndex: number;
  blockIndex: number;
  distance: number;
}

/**
 * Casa cada imagem com o bloco de texto mais proximo, na mesma coluna.
 *
 * A distancia e "ponto a intervalo": zero quando o rotulo cai dentro da faixa
 * vertical da propria imagem (como no catalogo Isabelle, onde a legenda fica
 * colada na base da foto), e a distancia ate a borda mais proxima quando o
 * rotulo fica claramente acima ou abaixo (como no catalogo Originais, onde o
 * nome fica acima e o preco sobre a base). Um so calculo cobre os dois
 * layouts sem hardcodar qual catalogo faz o que.
 *
 * O casamento e guloso: os pares mais proximos vencem primeiro, e uma imagem
 * ou um rotulo ja usado sai da mesa — evita que duas fotos da mesma coluna
 * disputem o mesmo rotulo vizinho.
 */
export function matchLabelsToImages(
  images: readonly Box[],
  blocks: readonly TextBlock[],
  pageWidth: number,
  maxDistance: number,
): LabelMatch[] {
  if (images.length === 0 || blocks.length === 0) {
    return [];
  }

  const imageColumns = clusterColumns(images, pageWidth);
  const blockColumns = clusterColumns(blocks, pageWidth);

  const candidates: LabelMatch[] = [];

  for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
    const image = images[imageIndex]!;

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      if (imageColumns[imageIndex] !== blockColumns[blockIndex]) {
        continue;
      }

      const block = blocks[blockIndex]!;
      const distance = verticalGap(image, block);

      if (distance <= maxDistance) {
        candidates.push({ imageIndex, blockIndex, distance });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);

  const usedImages = new Set<number>();
  const usedBlocks = new Set<number>();
  const matches: LabelMatch[] = [];

  for (const candidate of candidates) {
    if (usedImages.has(candidate.imageIndex) || usedBlocks.has(candidate.blockIndex)) {
      continue;
    }

    usedImages.add(candidate.imageIndex);
    usedBlocks.add(candidate.blockIndex);
    matches.push(candidate);
  }

  return matches;
}

/** Distancia vertical entre uma imagem e um bloco: 0 se um estiver dentro do outro. */
function verticalGap(image: Box, block: Box): number {
  if (block.y1 < image.y0) {
    return image.y0 - block.y1;
  }

  if (block.y0 > image.y1) {
    return block.y0 - image.y1;
  }

  return 0;
}
