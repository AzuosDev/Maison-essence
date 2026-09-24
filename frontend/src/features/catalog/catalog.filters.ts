import type { ProductListParams } from './catalog.keys';

/**
 * Os filtros da vitrine, em três formatos.
 *
 * O mesmo filtro precisa existir de três jeitos, e este arquivo e a única
 * ponte entre eles:
 *
 * 1. **Na URL** — `?marca=lattafa&min=100&estoque=1`. E o formato que o
 *    cliente vê, copia e manda no WhatsApp, e por isso as chaves estão em
 *    português e o preço esta em reais: `min=100` se lê, `minPrice=10000`
 *    não.
 * 2. **Em memória** — `CatalogFilters`, com tipo, já validado e com o preço
 *    em centavos, que e a moeda de todo o resto do código.
 * 3. **No fio** — `ProductListParams`, exatamente os nomes que
 *    `GET /products` aceita.
 *
 * A tradução do terceiro formato não e cosmética. O backend valida a query
 * com `forbidNonWhitelisted`, então um parâmetro que ele não conhece não e
 * ignorado: e um 400. Mandar a URL da tela direto para a API derrubaria a
 * listagem no primeiro filtro escrito em português.
 *
 * Tudo aqui e função pura sobre `URLSearchParams`. Não há estado, não há
 * React e não há rede — e o que permite testar o critério de aceite
 * ("aplicar três filtros e recarregar mantem tudo") sem montar uma tela.
 */

/* ---- Ordenação -------------------------------------------------------- */

/**
 * As ordens, com o nome que vai na URL.
 *
 * Em português pelo mesmo motivo das outras chaves, e mapeadas para o valor
 * que o backend aceita logo abaixo. Manter os dois vocabulários separados
 * significa que renomear `price_asc` no backend não inválida nenhum link já
 * compartilhado.
 */
export const SORT_KEYS = [
  'relevancia',
  'novidades',
  'menor-preco',
  'maior-preco',
  'desconto',
  'nome',
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  relevancia: 'Relevância',
  novidades: 'Mais recentes',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  desconto: 'Maior desconto',
  nome: 'Nome',
};

/** O nome de cada ordem em `PUBLIC_SORTS`, do backend. */
const SORT_TO_API: Record<SortKey, string> = {
  relevancia: 'relevance',
  novidades: 'newest',
  'menor-preco': 'price_asc',
  'maior-preco': 'price_desc',
  desconto: 'discount',
  nome: 'name',
};

/* ---- O estado ---------------------------------------------------------- */

export interface CatalogFilters {
  /** O termo buscado. Vazio fora de `/busca`. */
  q: string;
  /** Marca exata. O backend casa sem diferenciar maiúscula. */
  brand: string;
  /** Em centavos, como todo dinheiro. `null` e "sem piso". */
  minCents: number | null;
  maxCents: number | null;
  inStock: boolean;
  readyToShip: boolean;
  /**
   * Só produtos com desconto.
   *
   * Não existe como filtro em `GET /products` — ver `apiParamsFrom`, que
   * explica o que a vitrine faz no lugar.
   */
  onSale: boolean;
  /** `null` deixa a escolha com o backend: relevância com busca, novidade sem. */
  sort: SortKey | null;
  page: number;
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  brand: '',
  minCents: null,
  maxCents: null,
  inStock: false,
  readyToShip: false,
  onSale: false,
  sort: null,
  page: 1,
};

/**
 * O que a rota já decidiu, e que portanto não e escolha do cliente.
 *
 * `/categorias/amadeirados` fixa a categoria e `/pronta-entrega` fixa a
 * bandeira. Os dois viajam para a API como filtro, mas não aparecem na barra
 * lateral nem contam como "filtro aplicado": desmarcar aquilo que e o
 * próprio endereço da página não faria sentido.
 */
export interface CatalogContext {
  category?: string | undefined;
  readyToShip?: boolean | undefined;
}

/* ---- URL -> estado ----------------------------------------------------- */

/** As chaves como aparecem na barra de endereços. */
const KEYS = {
  q: 'q',
  brand: 'marca',
  min: 'min',
  max: 'max',
  inStock: 'estoque',
  readyToShip: 'pronta',
  onSale: 'desconto',
  sort: 'ordem',
  page: 'pagina',
} as const;

/** Teto do backend para qualquer valor em centavos (`MAX_CENTS`). */
const MAX_CENTS = 99_999_999;

export function filtersFromSearch(search: URLSearchParams): CatalogFilters {
  const minCents = reaisToCents(search.get(KEYS.min));
  const maxCents = reaisToCents(search.get(KEYS.max));

  return {
    q: (search.get(KEYS.q) ?? '').trim(),
    brand: (search.get(KEYS.brand) ?? '').trim(),
    // Faixa invertida — `min=500&max=100`, que só acontece em link editado a
    // mão — vira faixa nenhuma. O alternativo seria uma lista vazia sem
    // explicação nenhuma na tela.
    ...orderedRange(minCents, maxCents),
    inStock: flagFrom(search.get(KEYS.inStock)),
    readyToShip: flagFrom(search.get(KEYS.readyToShip)),
    onSale: flagFrom(search.get(KEYS.onSale)),
    sort: sortFrom(search.get(KEYS.sort)),
    page: pageFrom(search.get(KEYS.page)),
  };
}

/* ---- estado -> URL ----------------------------------------------------- */

/**
 * A query string de um estado de filtros.
 *
 * O que esta no padrão não e escrito: um catálogo sem filtro nenhum tem a
 * URL limpa `/produtos`, e não `/produtos?marca=&min=&pagina=1`. Além de
 * legível, isso mantem uma só URL por estado — duas grafias do mesmo recorte
 * seriam duas entradas de cache e duas páginas para o Google indexar.
 */
export function searchFromFilters(filters: CatalogFilters): URLSearchParams {
  const search = new URLSearchParams();

  setIfPresent(search, KEYS.q, filters.q);
  setIfPresent(search, KEYS.brand, filters.brand);
  setIfPresent(search, KEYS.min, centsToReais(filters.minCents));
  setIfPresent(search, KEYS.max, centsToReais(filters.maxCents));
  setIfTrue(search, KEYS.inStock, filters.inStock);
  setIfTrue(search, KEYS.readyToShip, filters.readyToShip);
  setIfTrue(search, KEYS.onSale, filters.onSale);
  setIfPresent(search, KEYS.sort, filters.sort ?? '');

  if (filters.page > 1) {
    search.set(KEYS.page, String(filters.page));
  }

  return search;
}

/* ---- estado -> API ----------------------------------------------------- */

/**
 * Teto de itens por página do backend (`MAX_PUBLIC_PAGE_SIZE`).
 *
 * Só e usado no modo "só com desconto", explicado logo abaixo.
 */
export const MAX_API_PAGE_SIZE = 48;

/** Quantos produtos a vitrine mostra por página. */
export const PAGE_SIZE = 24;

/**
 * Os filtros como `GET /products` os aceita.
 *
 * ## O filtro de desconto
 *
 * `GET /products` não tem parâmetro de "só com desconto" — tem a ordem
 * `discount`, que põe os maiores descontos na frente. A vitrine se apoia
 * nisso: com o filtro ligado ela pede a ordem `discount` e a página cheia
 * (48, o teto do backend), e descarta no cliente o que vier com desconto
 * zero. Como a ordem garante que todo produto em promoção vem antes de todo
 * produto sem promoção, o que sobra e exatamente o conjunto pedido — até o
 * quadragesimo oitavo.
 *
 * A consequência esta assumida e aparece na tela: passando de 48 produtos em
 * promoção ao mesmo tempo, a lista para no 48. Enquanto o backend estiver
 * fechado, e isto ou um filtro que mente na contagem. Um parâmetro
 * `hasDiscount` na API resolveria em uma linha, e aí esta função volta a ser
 * a tradução direta que e em todos os outros casos.
 */
export function apiParamsFrom(
  filters: CatalogFilters,
  context: CatalogContext = {},
): ProductListParams {
  const params: ProductListParams = {};

  if (context.category !== undefined && context.category !== '') {
    params.category = context.category;
  }

  if (filters.q !== '') {
    params.q = filters.q;
  }

  if (filters.brand !== '') {
    params.brand = filters.brand;
  }

  if (filters.minCents !== null) {
    params.minPrice = filters.minCents;
  }

  if (filters.maxCents !== null) {
    params.maxPrice = filters.maxCents;
  }

  // Bandeira desligada não viaja: para o backend, `readyToShip=false` quer
  // dizer "tanto faz", e mandar o campo a toa só engorda a chave de cache.
  if (filters.inStock) {
    params.inStock = true;
  }

  if (filters.readyToShip || context.readyToShip === true) {
    params.readyToShip = true;
  }

  if (filters.onSale) {
    // A varredura única descrita acima: uma página cheia, já ordenada por
    // desconto, que a tela recorta e página por conta própria.
    params.sort = SORT_TO_API.desconto;
    params.page = 1;
    params.limit = MAX_API_PAGE_SIZE;

    return params;
  }

  if (filters.sort !== null) {
    params.sort = SORT_TO_API[filters.sort];
  }

  if (filters.page > 1) {
    params.page = filters.page;
  }

  params.limit = PAGE_SIZE;

  return params;
}

/* ---- Perguntas sobre o estado ------------------------------------------ */

/**
 * Quantos filtros o cliente aplicou.
 *
 * E o número na bolinha do botão "Filtros" no celular. A faixa de preço
 * conta como um filtro mesmo com as duas pontas mexidas: para quem olha a
 * tela, arrastar o slider foi uma decisão, não duas.
 *
 * O que a rota impos não entra na conta. Em `/pronta-entrega`, a bandeira de
 * pronta entrega e o endereço da página, e não um filtro para limpar.
 */
export function countActiveFilters(filters: CatalogFilters, context: CatalogContext = {}): number {
  let count = 0;

  if (filters.brand !== '') {
    count += 1;
  }

  if (filters.minCents !== null || filters.maxCents !== null) {
    count += 1;
  }

  if (filters.inStock) {
    count += 1;
  }

  if (filters.readyToShip && context.readyToShip !== true) {
    count += 1;
  }

  if (filters.onSale) {
    count += 1;
  }

  return count;
}

/**
 * Limpa os filtros e preserva o que não e filtro.
 *
 * O termo buscado fica: em `/busca?q=amadeirado`, "limpar filtros" quer
 * dizer "me mostre tudo o que casa com amadeirado", e não "me tire desta
 * busca". A ordem também fica — e uma preferência de leitura, e não um
 * recorte do catálogo.
 */
export function clearedFilters(filters: CatalogFilters): CatalogFilters {
  return { ...EMPTY_FILTERS, q: filters.q, sort: filters.sort };
}

/* ---- Conversões -------------------------------------------------------- */

/**
 * `"100"` (reais, na URL) vira `10000` (centavos).
 *
 * Aceita só inteiro: o slider trabalha em reais cheios, e centavo na barra
 * de endereços seria ruído num link que vai para o WhatsApp. Qualquer outra
 * coisa — texto, negativo, vazio, acima do teto — vira `null`, que e "sem
 * limite". Link estragado abre a vitrine inteira, em vez de uma tela de erro.
 */
function reaisToCents(raw: string | null): number | null {
  if (raw === null || !/^\d{1,9}$/.test(raw)) {
    return null;
  }

  const cents = Number(raw) * 100;

  return cents > MAX_CENTS ? null : cents;
}

function centsToReais(cents: number | null): string {
  return cents === null ? '' : String(Math.round(cents / 100));
}

/**
 * Uma faixa em ordem, ou faixa nenhuma.
 *
 * `min` acima de `max` não e um filtro estreito: e um filtro impossível, que
 * o backend obedeceria devolvendo zero produtos.
 */
function orderedRange(
  minCents: number | null,
  maxCents: number | null,
): Pick<CatalogFilters, 'minCents' | 'maxCents'> {
  if (minCents !== null && maxCents !== null && minCents > maxCents) {
    return { minCents: null, maxCents: null };
  }

  return { minCents, maxCents };
}

/** `?estoque=1` liga; a ausência e qualquer outro valor deixam desligado. */
function flagFrom(raw: string | null): boolean {
  return raw === '1';
}

function sortFrom(raw: string | null): SortKey | null {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : null;
}

function pageFrom(raw: string | null): number {
  if (raw === null || !/^\d{1,4}$/.test(raw)) {
    return 1;
  }

  return Math.max(1, Number(raw));
}

function setIfPresent(search: URLSearchParams, key: string, value: string): void {
  if (value !== '') {
    search.set(key, value);
  }
}

function setIfTrue(search: URLSearchParams, key: string, value: boolean): void {
  if (value) {
    search.set(key, '1');
  }
}
