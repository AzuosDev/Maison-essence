/** Um fragmento de texto na pagina, em coordenadas PDF (y cresce para cima). */
export interface TextFragment {
  str: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Varios fragmentos reunidos num rotulo (nome de produto, titulo de secao). */
export interface TextBlock {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const PRICE_PATTERN = /^r\$/i;
const LEADING_NUMBER_PATTERN = /^\d+\s*[.\-):]\s*/;

/**
 * Um fragmento so com uma destas palavras e sempre uma faixa de genero solta
 * na pagina ("MASCULINOS", "FEMININOS"), nunca parte do nome de um produto —
 * nenhum item do catalogo se chama so isso. Isoladas assim porque, ao contrario
 * do nome de um produto, essa faixa costuma ficar centralizada na largura da
 * pagina em vez de alinhada a uma coluna da grade: sem essa excecao, ela cai
 * na coluna do meio por proximidade e gruda no rotulo do produto vizinho
 * ("MASCULINOS 2. KHAMRAH" em vez de "MASCULINOS" e "2. KHAMRAH" separados).
 */
const GENDER_BANNER_WORDS = new Set([
  'masculino',
  'masculinos',
  'masculina',
  'masculinas',
  'feminino',
  'femininos',
  'feminina',
  'femininas',
]);

function isGenderBanner(str: string): boolean {
  return GENDER_BANNER_WORDS.has(str.trim().toLowerCase());
}

/**
 * Remove fragmentos repetidos na mesma posicao.
 *
 * O catalogo Isabelle desenha cada rotulo mais de uma vez, na mesma posicao,
 * para o efeito de sombra do texto — sem isso toda palavra apareceria
 * duplicada ou triplicada no bloco final.
 */
export function dedupeFragments(fragments: readonly TextFragment[]): TextFragment[] {
  const seen = new Set<string>();
  const result: TextFragment[] = [];

  for (const fragment of fragments) {
    const key = `${fragment.str}|${Math.round(fragment.x0)}|${Math.round(fragment.y0)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(fragment);
  }

  return result;
}

/** `true` para uma faixa de preco ("R$ 135,00", "R$ 65,00 cada"), nunca um nome de produto. */
export function isPriceFragment(str: string): boolean {
  const trimmed = str.trim();

  return PRICE_PATTERN.test(trimmed) || /^cada$/i.test(trimmed);
}

/**
 * Agrupa fragmentos em blocos de texto (linhas contiguas, na mesma coluna).
 *
 * O nome de um produto quase sempre quebra em duas linhas ("ASAD" /
 * "TRADICIONAL") e as vezes em fragmentos separados na mesma linha ("9." e
 * "BADE'E AL OUD"). Os dois casos sao a mesma coisa vistos de perto: uma
 * sequencia de fragmentos proximos o bastante, na leitura de cima para baixo,
 * na mesma coluna. Preco fica de fora — nunca vira nome.
 *
 * A separacao em duas etapas (colunas primeiro, linhas dentro de cada coluna
 * depois) nao e estetica: um comparador de `sort` que decide "mesma linha,
 * ordene por x" ou "linha diferente, ordene por y" para o MESMO par muda de
 * criterio conforme o par, o que quebra a ordem total que `Array.sort`
 * pressupoe — o resultado passa a depender da implementacao e embaralha
 * rotulos de colunas diferentes que calham de ter o y parecido (exatamente o
 * que a grade de 3 colunas faz o tempo todo). Cada etapa aqui ordena por uma
 * chave so, sempre valida.
 */
export function groupIntoBlocks(fragments: readonly TextFragment[], pageWidth: number): TextBlock[] {
  const withoutPrices = fragments.filter((fragment) => !isPriceFragment(fragment.str));
  const banners = withoutPrices.filter((fragment) => isGenderBanner(fragment.str));
  const usable = withoutPrices.filter((fragment) => !isGenderBanner(fragment.str));

  if (usable.length === 0) {
    return banners.map((banner) => toBlock([banner]));
  }

  const heights = usable.map((fragment) => fragment.y1 - fragment.y0);
  const medianHeight = median(heights);
  const maxLineGap = Math.max(medianHeight * 1.6, 12);

  const columns = clusterByCenter(
    usable.map((fragment) => centerOf(fragment)),
    pageWidth * 0.12,
  );

  const byColumn = new Map<number, TextFragment[]>();

  usable.forEach((fragment, index) => {
    const column = columns[index]!;
    const list = byColumn.get(column) ?? [];

    list.push(fragment);
    byColumn.set(column, list);
  });

  const blocks: TextBlock[] = banners.map((banner) => toBlock([banner]));

  for (const columnFragments of byColumn.values()) {
    // Dentro da coluna, de cima para baixo: agora e uma unica chave (y0
    // decrescente), uma ordem total de verdade.
    const sorted = [...columnFragments].sort((a, b) => b.y0 - a.y0);

    let current: TextFragment[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i += 1) {
      const fragment = sorted[i]!;
      const previous = current[current.length - 1]!;
      const sameLine = Math.abs(fragment.y0 - previous.y0) < medianHeight * 0.5;
      const verticalGap = previous.y0 - fragment.y1;

      if (sameLine || (verticalGap >= -medianHeight && verticalGap <= maxLineGap)) {
        current.push(fragment);
      } else {
        blocks.push(toBlock(current));
        current = [fragment];
      }
    }

    blocks.push(toBlock(current));
  }

  return blocks;
}

/**
 * Agrupa numeros em clusters pelo vao entre um e o proximo, depois de
 * ordenados — a mesma ideia de `clusterColumns` em `columns.ts`, reaplicada
 * aqui para nao criar uma dependencia circular entre os dois modulos (este
 * arquivo alimenta `TextBlock`, que `columns.ts` consome).
 */
function clusterByCenter(centers: readonly number[], gapThreshold: number): number[] {
  const indexed = centers.map((center, index) => ({ index, center }));
  const sorted = [...indexed].sort((a, b) => a.center - b.center);
  const clusterOf = new Array<number>(centers.length);

  let cluster = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i]!.center - sorted[i - 1]!.center > gapThreshold) {
      cluster += 1;
    }

    clusterOf[sorted[i]!.index] = cluster;
  }

  return clusterOf;
}

/** Tira o numero de lista ("01 - ", "1. ", "9.") do texto do bloco. */
export function stripListNumber(text: string): string {
  return text.replace(LEADING_NUMBER_PATTERN, '').trim();
}

function toBlock(fragments: TextFragment[]): TextBlock {
  const text = fragments.map((fragment) => fragment.str.trim()).join(' ').replace(/\s+/g, ' ').trim();

  return {
    text,
    x0: Math.min(...fragments.map((f) => f.x0)),
    x1: Math.max(...fragments.map((f) => f.x1)),
    y0: Math.min(...fragments.map((f) => f.y0)),
    y1: Math.max(...fragments.map((f) => f.y1)),
  };
}

function centerOf(fragment: TextFragment): number {
  return (fragment.x0 + fragment.x1) / 2;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
