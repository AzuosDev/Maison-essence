import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Onde quem roda o script coloca os PDFs de catalogo. Fora do git. */
export const INPUT_DIR = resolve(HERE, 'input');

/** Onde o extrator grava as fotos e o mapa de slugs. Fora do git. */
export const OUTPUT_DIR = resolve(HERE, 'output');

/** `src/database/seeds/data/catalog.json`, a fonte dos slugs de produto. */
export const CATALOG_JSON_PATH = resolve(HERE, '../../src/database/seeds/data/catalog.json');

/**
 * Abaixo deste percentual da area da pagina, uma imagem e descartada por ser
 * foto de capa de secao ou o fundo decorativo que se repete em toda pagina.
 */
export const COVER_IMAGE_AREA_RATIO = 0.8;

/** Abaixo desta largura em pixels, a imagem e descartada por ser pequena demais. */
export const MIN_IMAGE_WIDTH_PX = 200;

/** Nota de correspondencia aproximada minima para aceitar um casamento fuzzy. */
export const FUZZY_MATCH_THRESHOLD = 0.85;

/**
 * Distancia de Hamming maxima entre dois phash de 256 bits para considerar
 * duplicata. Calibrado contra as fotos de "Body Mist" do catalogo Originais
 * (mesma pose, mesmo fundo, so o rotulo muda entre frascos): a menor
 * distancia medida entre dois frascos DIFERENTES daquela secao foi 13: 6 fica
 * com folga dos dois lados, longe o bastante de zero para nao acusar
 * artefato de recompressao como duplicata e longe o bastante de 13 para nao
 * confundir dois produtos parecidos. Ver o comentario de `perceptualHash`.
 */
export const PHASH_DUPLICATE_DISTANCE = 6;

/** Lado maior da imagem final, em pixels. */
export const OUTPUT_MAX_SIDE_PX = 1200;

/** Proporcao do card da loja: largura:altura = 3:4. */
export const OUTPUT_ASPECT_RATIO = 3 / 4;

export const OUTPUT_WEBP_QUALITY = 85;

/** Pasta do Cloudinary onde as fotos de produto sao publicadas. */
export const CLOUDINARY_PRODUCTS_FOLDER = 'maison-essence/products';

/**
 * Qual `sourceCatalog` do `catalog.json` corresponde a cada arquivo de
 * entrada, por um pedaco do nome do arquivo (sem acento, minusculo).
 *
 * `catalog.json` guarda a origem de cada produto em `sourceCatalog` (ver
 * `src/modules/catalog-import/catalog-file.ts` — o proprio importador de
 * catalogo a descarta na gravacao, mas ela continua no arquivo-fonte). Usar
 * essa tag para restringir a busca ao catalogo certo antes de qualquer
 * correspondencia de nome evita que "ASAD" de um catalogo va parar num
 * produto de outro catalogo que por acaso tem nome parecido.
 */
export const SOURCE_CATALOG_BY_FILENAME_HINT: ReadonlyArray<{
  hint: string;
  sourceCatalog: string;
}> = [
  { hint: 'isabelle', sourceCatalog: 'AM Atacadista - Isabelle La Belle' },
  { hint: 'arabe', sourceCatalog: 'AM Atacadista - Arabic Collection' },
  { hint: 'arabic', sourceCatalog: 'AM Atacadista - Arabic Collection' },
  { hint: 'origina', sourceCatalog: 'AM Atacadista - Originais' },
];
