import { readFileSync } from 'node:fs';
// A build "legacy" e a que roda em Node sem DOM: sem ela, `getDocument` espera
// `document`/`Path2D` do navegador e falha no import.
// eslint-disable-next-line import/no-unresolved -- resolvido em runtime pelo pacote, sem tipos proprios para o subpath.
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextFragment } from './text-blocks.js';

/** Uma imagem colada na pagina, com a caixa onde ela foi desenhada (pontos PDF). */
export interface PageImage {
  /** Id do objeto no PDF. O mesmo id se repete quando a mesma imagem e colada mais de uma vez. */
  objId: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  widthPx: number;
  heightPx: number;
  /** Pixels crus, RGB ou RGBA conforme `channels` — o que o `pdf.js` ja decodificou. */
  data: Uint8ClampedArray;
  channels: 3 | 4;
}

export interface PageContent {
  pageNumber: number;
  width: number;
  height: number;
  textFragments: TextFragment[];
  images: PageImage[];
}

/**
 * Matriz de transformacao acumulada (CTM) — a mesma matematica que o `pdf.js`
 * usa para desenhar. Sem ela nao ha como saber onde, na pagina, uma imagem
 * colada com `Do` foi de fato posicionada: a lista de operadores so diz "cole
 * a imagem X", a posicao vem de `cm` (`OPS.transform`) entre o `q`/`Q`
 * (`OPS.save`/`OPS.restore`) que a envolve.
 */
type Matrix = readonly [number, number, number, number, number, number];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

/** Le um PDF e devolve, pagina a pagina, o texto e as imagens que ele contem. */
export async function readPdf(path: string): Promise<PageContent[]> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: PageContent[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    // eslint-disable-next-line no-await-in-loop -- paginas de PDF sao lidas em sequencia por natureza.
    pages.push(await readPage(doc, pageNumber));
  }

  return pages;
}

async function readPage(
  doc: Awaited<ReturnType<typeof getDocument>['promise']>,
  pageNumber: number,
): Promise<PageContent> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  const textFragments = await readTextFragments(page);
  const images = await readImages(page);

  return { pageNumber, width: viewport.width, height: viewport.height, textFragments, images };
}

async function readTextFragments(page: { getTextContent: () => Promise<{ items: unknown[] }> }): Promise<TextFragment[]> {
  const content = await page.getTextContent();
  const fragments: TextFragment[] = [];

  for (const raw of content.items) {
    const item = raw as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
      height?: unknown;
    };

    if (typeof item.str !== 'string' || item.str.trim() === '') {
      continue;
    }

    if (!Array.isArray(item.transform) || item.transform.length < 6) {
      continue;
    }

    const [, , , , x, y] = item.transform as number[];
    const width = typeof item.width === 'number' ? item.width : 0;
    const height = typeof item.height === 'number' ? item.height : 0;

    fragments.push({ str: item.str, x0: x!, y0: y!, x1: x! + width, y1: y! + height });
  }

  return fragments;
}

interface PageObjects {
  get: (id: string, callback?: (data: unknown) => void) => unknown;
}

/**
 * Espera um objeto de imagem do PDF ficar pronto, com um teto de tempo.
 *
 * `page.objs.get(id)` sem callback e sincrono: devolve na hora se o objeto
 * ja foi decodificado, ou **lanca** "Requesting object that isn't resolved
 * yet" se ainda nao foi — nao existe um meio-termo assincrono nessa forma.
 * A forma com callback espera de verdade, registrando um `.then()` na
 * promise interna do objeto.
 *
 * O teto existe porque alguns objetos so sao resolvidos durante
 * `page.render()` — que este extrator nao chama de proposito, para nao
 * precisar de canvas em Node so para decodificar pixels que o `pdf.js` ja
 * devolve crus por `getOperatorList()`. Sem o teto, um desses objetos
 * pendura o processo inteiro esperando um `resolve()` que nunca vem; com
 * ele, essa imagem em particular e tratada como as outras falhas de
 * decodificacao — ignorada, sem derrubar a pagina.
 */
function getObjectAsync(objs: PageObjects, objId: string, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(undefined);
      }
    }, timeoutMs);

    objs.get(objId, (data) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(data);
      }
    });
  });
}

async function readImages(page: {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: PageObjects;
}): Promise<PageImage[]> {
  const opList = await page.getOperatorList();
  const placements: { objId: string; x0: number; y0: number; x1: number; y1: number }[] = [];

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i]!;

    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = multiply(args as unknown as Matrix, ctm);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const objId = args[0] as string;
      // A imagem e colada no quadrado unitario [0,1]x[0,1]; a CTM leva esse
      // quadrado ate a caixa real na pagina.
      const corners: [number, number][] = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([ux, uy]) => [ctm[0] * ux + ctm[2] * uy + ctm[4], ctm[1] * ux + ctm[3] * uy + ctm[5]]);
      const xs = corners.map((p) => p[0]);
      const ys = corners.map((p) => p[1]);

      placements.push({
        objId,
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
      });
    }
  }

  // Uma imagem colada mais de uma vez (a logo repetida em cada celula, por
  // exemplo) so e decodificada uma vez, e as demais aparicoes reaproveitam o
  // mesmo buffer — sao pixels identicos por definicao (mesmo objeto do PDF).
  const decoded = new Map<string, DecodedImage | null>();

  for (const placement of placements) {
    if (decoded.has(placement.objId)) {
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop -- ver `getObjectAsync`: cada objeto e uma espera propria, nao ha lote possivel na API do pdf.js.
      const raw = await getObjectAsync(page.objs, placement.objId);

      if (typeof raw !== 'object' || raw === null) {
        decoded.set(placement.objId, null);
        continue;
      }

      const object = raw as {
        width?: unknown;
        height?: unknown;
        data?: unknown;
        kind?: unknown;
      };

      if (
        typeof object.width !== 'number' ||
        typeof object.height !== 'number' ||
        !(object.data instanceof Uint8ClampedArray)
      ) {
        decoded.set(placement.objId, null);
        continue;
      }

      // `ImageKind`: 1 = escala de cinza, 2 = RGB, 3 = RGBA. `pdf.js` ja
      // decodificou JPEG/JPX para pixels crus — nao ha PNG nem JPEG para
      // decodificar aqui, so escolher quantos canais o buffer tem.
      const channels: 3 | 4 = object.kind === 3 ? 4 : 3;

      decoded.set(placement.objId, {
        widthPx: object.width,
        heightPx: object.height,
        data: object.data,
        channels,
      });
    } catch {
      // Objeto inline ou mascara que o `pdf.js` guarda de outro jeito: sem
      // pixels crus para extrair, a imagem e ignorada em vez de derrubar a
      // pagina inteira.
      decoded.set(placement.objId, null);
    }
  }

  const images: PageImage[] = [];

  for (const placement of placements) {
    const object = decoded.get(placement.objId);

    if (object === null || object === undefined) {
      continue;
    }

    images.push({ ...placement, ...object });
  }

  return images;
}

interface DecodedImage {
  widthPx: number;
  heightPx: number;
  data: Uint8ClampedArray;
  channels: 3 | 4;
}
