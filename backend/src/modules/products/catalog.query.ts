import type { PipelineStage, QueryFilter, Types, mongo } from 'mongoose';
import { escapeRegex, searchFilter, usesTextIndex } from './product-search.js';
import type { Product } from './schemas/product.schema.js';

export const PUBLIC_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'discount',
  'name',
] as const;

export type PublicSort = (typeof PUBLIC_SORTS)[number];

export interface CatalogFilterInput {
  /** A categoria pedida e as subcategorias dela, ja resolvidas do slug. */
  categoryIds?: readonly Types.ObjectId[];
  q?: string;
  brand?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
  readyToShip?: boolean;
  featured?: boolean;
}

/** Campos que o documento nao guarda e a ordenacao precisa. Somem no fim. */
const LIVE = '_liveVariants';
const PRICE = '_price';
const DISCOUNT = '_discount';
const SCORE = '_score';

/**
 * O filtro da vitrine inteiro, em um documento so.
 *
 * Preco, estoque e "esta a venda" sao perguntas sobre a mesma variante, e por
 * isso vao juntas em um unico `$elemMatch`: sem ele, o Mongo aceitaria um
 * produto cuja variante barata esta esgotada e cuja variante em estoque custa
 * o dobro do teto pedido — cada condicao casaria com uma variante diferente.
 *
 * `isActive: true` no `$elemMatch` faz dobradinha: filtra pela variante certa
 * e, de quebra, descarta o produto que ficou sem nenhuma variante a venda.
 */
export function catalogFilter(input: CatalogFilterInput): QueryFilter<Product> {
  const filter: QueryFilter<Product> = { isActive: true };

  if (input.categoryIds !== undefined) {
    filter.categoryIds = { $in: [...input.categoryIds] };
  }

  if (input.brand !== undefined && input.brand.length > 0) {
    // Ancorado e sem diferenciar maiuscula: o filtro vem de um clique na
    // lista de marcas, e `lattafa` tem que achar `Lattafa`.
    filter.brand = new RegExp(`^${escapeRegex(input.brand)}$`, 'i');
  }

  // Bandeira so filtra quando ligada. `featured=false` quer dizer "tanto
  // faz", e nao "me mostre o que nao e destaque" — nao existe essa vitrine.
  if (input.readyToShip === true) {
    filter.isReadyToShip = true;
  }

  if (input.featured === true) {
    filter.isFeatured = true;
  }

  filter.variants = { $elemMatch: variantMatch(input) };

  const term = input.q ?? '';

  return term.length > 0 ? { ...filter, ...searchFilter(term) } : filter;
}

function variantMatch(input: CatalogFilterInput): Record<string, unknown> {
  const match: Record<string, unknown> = { isActive: true };

  if (input.minPriceCents !== undefined || input.maxPriceCents !== undefined) {
    match.priceCents = {
      ...(input.minPriceCents === undefined ? {} : { $gte: input.minPriceCents }),
      ...(input.maxPriceCents === undefined ? {} : { $lte: input.maxPriceCents }),
    };
  }

  if (input.inStock === true) {
    // Encomenda conta como em estoque: e venda que a dona fecha hoje.
    match.$or = [{ stock: { $gt: 0 } }, { allowBackorder: true }];
  }

  return match;
}

/**
 * A pagina de cards, em uma agregacao.
 *
 * Agregacao e nao `find` porque preco e desconto do produto nao estao
 * gravados: sao o menor preco e o maior desconto *entre as variantes a
 * venda*. Ordenar por `variants.priceCents` direto colocaria o produto no
 * lugar da variante aposentada, e "menor preco" mostraria primeiro um preco
 * que ninguem pode pagar.
 */
export function catalogPipeline(
  filter: QueryFilter<Product>,
  sort: PublicSort,
  hasText: boolean,
  skip: number,
  limit: number,
): PipelineStage[] {
  const stages: PipelineStage[] = [{ $match: filter }];
  const computed: string[] = [];

  if (sort === 'relevance' && hasText) {
    stages.push({ $addFields: { [SCORE]: { $meta: 'textScore' } } });
    computed.push(SCORE);
  }

  if (needsPriceFields(sort)) {
    stages.push(
      { $addFields: { [LIVE]: liveVariants() } },
      { $addFields: { [PRICE]: { $min: `$${LIVE}.priceCents` }, [DISCOUNT]: discountRatio() } },
    );
    computed.push(LIVE, PRICE, DISCOUNT);
  }

  stages.push({ $sort: sortStage(sort, hasText) }, { $skip: skip }, { $limit: limit });
  // `description` nao cabe no card e e o maior campo do produto: buscar cinco
  // mil caracteres por linha para jogar fora no mapeamento pesaria a resposta
  // inteira da vitrine.
  stages.push({ $unset: [...computed, 'description'] });

  return stages;
}

/** Ordenacao por nome precisa de collation: sem ela, `Agua` cai depois de `Zebra`. */
export function catalogCollation(sort: PublicSort): mongo.CollationOptions | undefined {
  return sort === 'name' ? { locale: 'pt', strength: 1 } : undefined;
}

/** A ordenacao pedida vale? `relevance` sem busca nao ordena nada. */
export function effectiveSort(sort: PublicSort | undefined, hasText: boolean): PublicSort {
  if (sort === undefined) {
    // Com busca, relevancia; sem busca, a novidade primeiro.
    return hasText ? 'relevance' : 'newest';
  }

  return sort === 'relevance' && !hasText ? 'newest' : sort;
}

/** A busca digitada usa o indice de texto, ou caiu no regex de termo curto? */
export function hasTextScore(term: string): boolean {
  return term.length > 0 && usesTextIndex(term);
}

type SortDirection = 1 | -1;

function sortStage(sort: PublicSort, hasText: boolean): Record<string, SortDirection> {
  // `_id` fecha toda ordenacao: sem criterio de desempate, dois produtos com
  // o mesmo preco podem trocar de lugar entre a pagina 1 e a 2 e um deles
  // some da listagem.
  const tiebreak: Record<string, SortDirection> = { _id: -1 };

  switch (sort) {
    case 'relevance':
      return hasText
        ? { [SCORE]: -1, createdAt: -1, ...tiebreak }
        : { createdAt: -1, ...tiebreak };
    case 'price_asc':
      return { [PRICE]: 1, ...tiebreak };
    case 'price_desc':
      // Pelo menor preco tambem na ordem inversa: e o numero que o card
      // exibe — "a partir de R$ 100" — e ordenar por um preco que a tela nao
      // mostra faz a lista parecer embaralhada.
      return { [PRICE]: -1, ...tiebreak };
    case 'discount':
      return { [DISCOUNT]: -1, createdAt: -1, ...tiebreak };
    case 'name':
      return { name: 1, ...tiebreak };
    default:
      return { createdAt: -1, ...tiebreak };
  }
}

function needsPriceFields(sort: PublicSort): boolean {
  return sort === 'price_asc' || sort === 'price_desc' || sort === 'discount';
}

function liveVariants(): Record<string, unknown> {
  return { $filter: { input: '$variants', as: 'v', cond: '$$v.isActive' } };
}

/**
 * O maior desconto do produto, como fracao.
 *
 * Fracao e nao o percentual inteiro de proposito: aqui isso e so chave de
 * ordenacao, e repetir no dialeto do Mongo o arredondamento para baixo de
 * `discountOf` criaria duas versoes da mesma regra para divergirem depois. A
 * ordem e a mesma; o numero que a tela exibe continua saindo da view.
 *
 * `compareAtPriceCents` nulo cai no zero sozinho: na ordem do BSON, null vem
 * antes de qualquer numero, entao o `$gt` e falso.
 */
function discountRatio(): Record<string, unknown> {
  return {
    $max: {
      $map: {
        input: `$${LIVE}`,
        as: 'v',
        in: {
          $cond: [
            { $gt: ['$$v.compareAtPriceCents', '$$v.priceCents'] },
            {
              $divide: [
                { $subtract: ['$$v.compareAtPriceCents', '$$v.priceCents'] },
                '$$v.compareAtPriceCents',
              ],
            },
            0,
          ],
        },
      },
    },
  };
}
