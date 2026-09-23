import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { slugify } from '../../src/database/slug.js';
import {
  CATALOG_JSON_PATH,
  COVER_IMAGE_AREA_RATIO,
  FUZZY_MATCH_THRESHOLD,
  INPUT_DIR,
  MIN_IMAGE_WIDTH_PX,
  OUTPUT_DIR,
  PHASH_DUPLICATE_DISTANCE,
  SOURCE_CATALOG_BY_FILENAME_HINT,
} from './config.js';
import { dedupeFragments, groupIntoBlocks, stripListNumber, type TextBlock } from './text-blocks.js';
import { matchLabelsToImages } from './columns.js';
import { readPdf } from './pdf-geometry.js';
import type { PageImage } from './pdf-geometry.js';
import { SectionTracker, type CategoryLike } from './sections.js';
import { matchProduct, type ProductLike } from './slug-match.js';
import { processProductImage } from './image-process.js';
import { hammingDistance, perceptualHash } from './phash.js';
import { buildReviewHtml, emptyReport, formatReport, recordItem, type ExtractReport } from './report.js';

/**
 * `npm run images:extract`
 *
 * Le os catalogos PDF em `scripts/catalog-images/input/`, casa cada foto de
 * produto com o slug certo em `catalog.json` e grava o resultado em
 * `scripts/catalog-images/output/`:
 *
 *   - `<slug>.webp`             a foto de cada produto casado, pronta para o card da loja
 *   - `images-map.json`         slug -> caminho do arquivo, para o `images:upload`
 *   - `review.html`             toda foto candidata, para conferencia antes de subir
 *
 * ```
 * npm run images:extract
 * npm run images:extract -- --pdf=./scripts/catalog-images/input/outro.pdf
 * npm run images:extract -- --threshold=0.9
 * ```
 *
 * Nao grava nada no banco nem no Cloudinary — isso e o `images:upload`, o
 * segundo comando, deliberadamente separado para que a conferencia em
 * `review.html` aconteca entre os dois.
 */

interface CliOptions {
  pdfPaths: string[];
  outDir: string;
  catalogPath: string;
  threshold: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const pdfFlags = argv.filter((arg) => arg.startsWith('--pdf='));
  const outFlag = argv.find((arg) => arg.startsWith('--out='));
  const catalogFlag = argv.find((arg) => arg.startsWith('--catalog='));
  const thresholdFlag = argv.find((arg) => arg.startsWith('--threshold='));

  const pdfPaths =
    pdfFlags.length > 0
      ? pdfFlags.map((flag) => resolve(flag.slice('--pdf='.length)))
      : listPdfsIn(INPUT_DIR);

  return {
    pdfPaths,
    outDir: outFlag !== undefined ? resolve(outFlag.slice('--out='.length)) : OUTPUT_DIR,
    catalogPath: catalogFlag !== undefined ? resolve(catalogFlag.slice('--catalog='.length)) : CATALOG_JSON_PATH,
    threshold: thresholdFlag !== undefined ? Number(thresholdFlag.slice('--threshold='.length)) : FUZZY_MATCH_THRESHOLD,
  };
}

function listPdfsIn(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => extname(name).toLowerCase() === '.pdf')
      .map((name) => resolve(dir, name));
  } catch {
    return [];
  }
}

/** De qual `sourceCatalog` um arquivo de entrada e, pelo nome do arquivo. */
function sourceCatalogFor(pdfPath: string): string | null {
  const name = basename(pdfPath)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  const hint = SOURCE_CATALOG_BY_FILENAME_HINT.find((entry) => name.includes(entry.hint));

  return hint?.sourceCatalog ?? null;
}

interface CatalogFile {
  categories: CategoryLike[];
  products: ProductLike[];
}

function readCatalog(path: string): CatalogFile {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    categories: { slug: string; name: string; parentSlug: string | null }[];
    products: { slug: string; name: string; categorySlugs: string[]; sourceCatalog: string }[];
  };

  return {
    categories: raw.categories.map((c) => ({ slug: c.slug, name: c.name, parentSlug: c.parentSlug })),
    products: raw.products.map((p) => ({
      slug: p.slug,
      name: p.name,
      categorySlugs: p.categorySlugs,
      sourceCatalog: p.sourceCatalog,
    })),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.pdfPaths.length === 0) {
    console.error(
      `Nenhum PDF encontrado. Coloque os catalogos em ${INPUT_DIR} ou use --pdf=<caminho>.`,
    );
    process.exitCode = 1;

    return;
  }

  const catalog = readCatalog(options.catalogPath);
  const report = emptyReport();
  const assignedSlugs = new Set<string>();
  const seenHashes: bigint[] = [];

  mkdirSync(options.outDir, { recursive: true });
  mkdirSync(resolve(options.outDir, 'review-assets'), { recursive: true });

  for (const pdfPath of options.pdfPaths) {
    // eslint-disable-next-line no-await-in-loop -- os catalogos sao poucos e processados um de cada vez de proposito, para o relatorio final somar todos.
    await processPdf(pdfPath, catalog, options, report, assignedSlugs, seenHashes);
  }

  report.productsWithoutImage = catalog.products
    .filter((product) => !assignedSlugs.has(product.slug))
    .map((product) => ({ slug: product.slug, name: product.name }));

  const imagesMap = Object.fromEntries(
    report.items
      .filter((item) => item.status === 'matched-exact' || item.status === 'matched-approximate')
      .map((item) => [item.matchedSlug!, `${item.matchedSlug}.webp`]),
  );

  writeFileSync(resolve(options.outDir, 'images-map.json'), `${JSON.stringify(imagesMap, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(options.outDir, 'review.html'), buildReviewHtml(report), 'utf8');

  for (const line of formatReport(report)) {
    console.log(line);
  }

  console.log('');
  console.log(`Fotos gravadas em ${options.outDir}`);
  console.log(`Abra ${resolve(options.outDir, 'review.html')} para conferir antes de rodar images:upload.`);

  if (report.productsWithoutImage.length > 0) {
    console.log('');
    console.log(`Produtos sem foto (${report.productsWithoutImage.length}):`);

    for (const product of report.productsWithoutImage.slice(0, 30)) {
      console.log(`  ${product.slug}`);
    }

    if (report.productsWithoutImage.length > 30) {
      console.log(`  ... e mais ${report.productsWithoutImage.length - 30}`);
    }
  }
}

async function processPdf(
  pdfPath: string,
  catalog: CatalogFile,
  options: CliOptions,
  report: ExtractReport,
  assignedSlugs: Set<string>,
  seenHashes: bigint[],
): Promise<void> {
  const pdfFile = basename(pdfPath);
  const sourceCatalog = sourceCatalogFor(pdfPath);
  const sourceProducts = sourceCatalog === null ? [] : catalog.products.filter((p) => p.sourceCatalog === sourceCatalog);

  if (sourceCatalog === null) {
    console.warn(
      `Aviso: nao sei a qual catalogo "${pdfFile}" pertence (ver SOURCE_CATALOG_BY_FILENAME_HINT em config.ts). Toda foto dele vai para "sem correspondencia".`,
    );
  }

  const pages = await readPdf(pdfPath);
  const tracker = new SectionTracker(catalog.categories);
  const pdfSlug = slugify(basename(pdfPath, extname(pdfPath)));

  let imageSeq = 0;

  for (const page of pages) {
    const blocks = groupIntoBlocks(dedupeFragments(page.textFragments), page.width);
    const orderedBlocks = [...blocks].sort((a, b) => b.y0 - a.y0);
    const categoryAt = new Map<TextBlock, CategoryLike | null>();

    for (const block of orderedBlocks) {
      tracker.observe(block.text);
      categoryAt.set(block, tracker.resolve());
    }

    const pageArea = page.width * page.height;
    const survivors: PageImage[] = [];

    for (const image of page.images) {
      const area = (image.x1 - image.x0) * (image.y1 - image.y0);
      const isCover = area / pageArea > COVER_IMAGE_AREA_RATIO;
      const isTooSmall = !isCover && image.widthPx < MIN_IMAGE_WIDTH_PX;

      if (!isCover && !isTooSmall) {
        survivors.push(image);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- mesmo descartada, a foto entra na galeria de conferencia (item 10): e o unico jeito de provar que nenhuma capa virou foto de produto.
      const processed = await processProductImage(image);

      imageSeq += 1;
      recordItem(report, {
        pdfFile,
        pageNumber: page.pageNumber,
        rawText: '',
        status: isCover ? 'discarded-cover' : 'discarded-small',
        matchedSlug: null,
        matchedName: null,
        score: null,
        thumbnailPath: writeReviewAsset(options.outDir, pdfSlug, imageSeq, processed),
      });
    }

    const matches = matchLabelsToImages(
      survivors,
      blocks,
      page.width,
      // Vao maximo generoso: no catalogo Isabelle a legenda fica dentro da
      // propria foto (vao zero), no Originais ela fica acima com uma folga
      // pequena. 220pt cobre os dois sem colar a legenda da linha vizinha.
      220,
    );

    const labelOfImage = new Map<number, TextBlock>();

    for (const match of matches) {
      labelOfImage.set(match.imageIndex, blocks[match.blockIndex]!);
    }

    for (let i = 0; i < survivors.length; i += 1) {
      const image = survivors[i]!;

      // eslint-disable-next-line no-await-in-loop -- o phash precisa do resultado antes de decidir se a imagem segue.
      const hash = await perceptualHash(image);
      const duplicate = seenHashes.some((seen) => hammingDistance(seen, hash) <= PHASH_DUPLICATE_DISTANCE);

      if (duplicate) {
        // eslint-disable-next-line no-await-in-loop -- mesma justificativa do descarte por capa: a galeria precisa mostrar a duplicata para provar que ela foi mesmo descartada.
        const processed = await processProductImage(image);

        imageSeq += 1;
        recordItem(report, {
          pdfFile,
          pageNumber: page.pageNumber,
          rawText: '',
          status: 'discarded-duplicate',
          matchedSlug: null,
          matchedName: null,
          score: null,
          thumbnailPath: writeReviewAsset(options.outDir, pdfSlug, imageSeq, processed),
        });
        continue;
      }

      seenHashes.push(hash);

      const label = labelOfImage.get(i);
      const rawText = label !== undefined ? stripListNumber(label.text) : '';
      const category = label !== undefined ? (categoryAt.get(label) ?? tracker.resolve()) : tracker.resolve();
      const group =
        category === null
          ? []
          : sourceProducts.filter((p) => p.categorySlugs.includes(category.slug));

      const result = matchProduct(rawText, group, sourceProducts, options.threshold);

      // eslint-disable-next-line no-await-in-loop -- uma foto de cada vez; sao no maximo algumas centenas por catalogo.
      const processed = await processProductImage(image);
      imageSeq += 1;

      if (result === null) {
        const thumbnailPath = writeReviewAsset(options.outDir, pdfSlug, imageSeq, processed);

        recordItem(report, {
          pdfFile,
          pageNumber: page.pageNumber,
          rawText,
          status: 'unmatched',
          matchedSlug: null,
          matchedName: null,
          score: null,
          thumbnailPath,
        });
        continue;
      }

      if (assignedSlugs.has(result.product.slug)) {
        const thumbnailPath = writeReviewAsset(options.outDir, pdfSlug, imageSeq, processed);

        recordItem(report, {
          pdfFile,
          pageNumber: page.pageNumber,
          rawText,
          status: 'discarded-duplicate-slug',
          matchedSlug: result.product.slug,
          matchedName: result.product.name,
          score: result.score,
          thumbnailPath,
        });
        continue;
      }

      assignedSlugs.add(result.product.slug);
      writeFileSync(resolve(options.outDir, `${result.product.slug}.webp`), processed);

      recordItem(report, {
        pdfFile,
        pageNumber: page.pageNumber,
        rawText,
        status: result.kind === 'exact' ? 'matched-exact' : 'matched-approximate',
        matchedSlug: result.product.slug,
        matchedName: result.product.name,
        score: result.score,
        thumbnailPath: `${result.product.slug}.webp`,
      });
    }
  }
}

function writeReviewAsset(outDir: string, pdfSlug: string, imageSeq: number, buffer: Buffer): string {
  const relativePath = `review-assets/${pdfSlug}-p${imageSeq}.webp`;

  writeFileSync(resolve(outDir, relativePath), buffer);

  return relativePath;
}

await main();
