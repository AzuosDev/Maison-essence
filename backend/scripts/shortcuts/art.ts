import sharp from 'sharp';

/**
 * O recorte do fundo da arte do atalho.
 *
 * ## Por que a arte precisa de transparencia
 *
 * O circulo da home deixou de recortar a foto: o disco dourado da arte **e**
 * o circulo, e o que a arte desenha fora dele — o frasco mais alto que o
 * disco, a asa do pavao que passa da borda — sai para fora e fica por cima da
 * pagina. E o enquadramento que a dona pediu, e ele so funciona se o que
 * estiver entre o disco e a quina do arquivo for transparente.
 *
 * As artes chegam em JPEG, que nao tem canal alfa: o que parece vazio e um
 * quadrado branco. Sem recorte, esse quadrado apareceria em volta de cada
 * circulo — invisivel sobre o branco da loja, e um bloco branco no tema
 * escuro, cobrindo ainda a sobra do circulo vizinho.
 *
 * ## Como o recorte decide o que e fundo
 *
 * Por conexao com a borda do arquivo, e nao por cor. Um `floodfill` que parte
 * das quatro beiradas e so atravessa pixel quase branco: o rotulo branco do
 * frasco e o reflexo branco da tampa ficam, porque estao cercados de produto
 * e a inundacao nunca chega neles. Trocar isso por "todo pixel branco sai"
 * furaria o meio dos produtos claros, que e metade do catalogo.
 *
 * A franja de um pixel na divisa recebe alfa proporcional e tem o branco
 * descontado da cor (`unpremultiply`). Sem isso a borda de cada frasco ficaria
 * com um fio claro — invisivel na loja clara, e um contorno leitoso no tema
 * escuro, que e exatamente o defeito que o recorte existe para evitar.
 */

/** Acima disto o pixel e fundo, se estiver ligado a borda do arquivo. */
const BACKGROUND_FLOOR = 232;

/** Entre este valor e o de cima esta a franja: fundo misturado com produto. */
const FRINGE_FLOOR = 208;

/** O resultado do recorte, para o script poder contar o que fez. */
export interface CutArt {
  /** O PNG com fundo transparente, pronto para subir. */
  buffer: Buffer;
  /** Quanto do quadrado virou transparente, de 0 a 1. */
  cutRatio: number;
}

/**
 * A arte com o fundo branco virado transparencia.
 *
 * Devolve sempre um PNG: e o formato que o Cloudinary guarda com alfa, e o
 * `f_auto` da entrega converte para webp ou avif em quem souber ler.
 */
export async function cutBackground(filePath: string): Promise<CutArt> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = width * height;
  const isBackground = new Uint8Array(pixels);

  const minChannelAt = (index: number): number => {
    const at = index * channels;

    return Math.min(data[at], data[at + 1], data[at + 2]);
  };

  /*
   * A inundacao parte das quatro beiradas, que e o unico lugar onde o fundo
   * com certeza esta: qualquer regiao clara cercada de produto — o rotulo, o
   * reflexo da tampa — fica de fora porque a pilha nunca chega ate ela.
   */
  const stack: number[] = [];

  const push = (index: number): void => {
    if (isBackground[index] === 0 && minChannelAt(index) >= BACKGROUND_FLOOR) {
      isBackground[index] = 1;
      stack.push(index);
    }
  };

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % width;
    const y = (index - x) / width;

    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  let cut = 0;

  for (let index = 0; index < pixels; index += 1) {
    const at = index * channels;

    if (isBackground[index] === 1) {
      data[at + 3] = 0;
      cut += 1;
      continue;
    }

    const min = minChannelAt(index);

    if (min < FRINGE_FLOOR || !touchesBackground(isBackground, index, width, height)) {
      continue;
    }

    // A franja: alfa proporcional a quanto o pixel ainda nao e branco, e a
    // cor com o branco descontado — senao o fio claro fica.
    const alpha = Math.round((255 * (255 - min)) / (255 - FRINGE_FLOOR));

    data[at + 3] = alpha;
    data[at] = unpremultiply(data[at], alpha);
    data[at + 1] = unpremultiply(data[at + 1], alpha);
    data[at + 2] = unpremultiply(data[at + 2], alpha);
  }

  const buffer = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();

  return { buffer, cutRatio: cut / pixels };
}

/** Se o pixel faz divisa com o fundo — e so na divisa que ha franja. */
function touchesBackground(
  isBackground: Uint8Array,
  index: number,
  width: number,
  height: number,
): boolean {
  const x = index % width;
  const y = (index - x) / width;

  return (
    (x > 0 && isBackground[index - 1] === 1) ||
    (x < width - 1 && isBackground[index + 1] === 1) ||
    (y > 0 && isBackground[index - width] === 1) ||
    (y < height - 1 && isBackground[index + width] === 1)
  );
}

/** A cor sem o branco que a mistura da franja trouxe junto. */
function unpremultiply(channel: number, alpha: number): number {
  if (alpha === 0) {
    return channel;
  }

  const ratio = alpha / 255;
  const pure = (channel - 255 * (1 - ratio)) / ratio;

  return Math.max(0, Math.min(255, Math.round(pure)));
}
