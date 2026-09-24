import type { AdminProductListParams } from './admin.keys';
import { ADMIN_PAGE_SIZE, PRODUCT_STATUS_FILTERS, type ProductStatusFilter } from './admin.types';

/**
 * O recorte da listagem de produtos.
 *
 * Mesmo desenho do de pedidos (`order-filters.ts`) e pelas mesmas razões: o
 * recorte mora no endereço, para que o card "Sem estoque" da abertura possa
 * apontar para um filtro, para que a dona consiga mandar o link de um recorte
 * e para que o botão voltar devolva a lista como ela estava.
 *
 * O que muda são os eixos. Aqui não há período — ninguém procura produto por
 * data de cadastro — e há **categoria**, que e como a dona pensa o catálogo:
 * ela não procura "Asad", procura "o que eu tenho de masculino".
 */

export interface ProductFilters {
  /** Busca por nome e marca. */
  q: string;
  categoryId: string;
  /** `all` e o padrão: o cadastro inteiro, no ar ou não. */
  status: ProductStatusFilter;
  page: number;
}

export const EMPTY_PRODUCT_FILTERS: ProductFilters = {
  q: '',
  categoryId: '',
  status: 'all',
  page: 1,
};

const STATUS_VALUES: readonly string[] = PRODUCT_STATUS_FILTERS;

/**
 * `ObjectId` em hexadecimal, só a forma.
 *
 * Existe para não mandar lixo ao servidor: `@IsMongoId` recusaria com 400, e
 * a lista inteira desapareceria por causa de um endereço colado torto. Uma
 * categoria que **existe** e outra pergunta, e quem a responde e a consulta.
 */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function readProductFilters(search: URLSearchParams): ProductFilters {
  const status = search.get('status') ?? '';
  const categoryId = search.get('categoria') ?? '';
  const page = Number.parseInt(search.get('page') ?? '', 10);

  return {
    q: (search.get('q') ?? '').trim(),
    categoryId: OBJECT_ID.test(categoryId) ? categoryId : '',
    status: STATUS_VALUES.includes(status) ? (status as ProductStatusFilter) : 'all',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * O endereço que descreve o recorte.
 *
 * `categoria` em português, e não `categoryId`: e um endereço que a dona lê e
 * manda para quem ajuda, como o resto das rotas do painel. `status` e `page`
 * ficam em inglês porque são os nomes que a API já usa e que ninguém lê.
 *
 * O que esta no padrão não entra: `/admin/produtos` diz o mesmo que
 * `/admin/produtos?q=&categoria=&status=all&page=1`, e e mais curto de mandar.
 */
export function productFiltersToSearch(filters: ProductFilters): Record<string, string> {
  const search: Record<string, string> = {};

  if (filters.q !== '') {
    search.q = filters.q;
  }

  if (filters.categoryId !== '') {
    search.categoria = filters.categoryId;
  }

  if (filters.status !== 'all') {
    search.status = filters.status;
  }

  if (filters.page > 1) {
    search.page = String(filters.page);
  }

  return search;
}

/** O recorte como a API o espera. Campo vazio some em vez de viajar em branco. */
export function productListParams(filters: ProductFilters): AdminProductListParams {
  return {
    page: filters.page,
    limit: ADMIN_PAGE_SIZE,
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(filters.categoryId === '' ? {} : { categoryId: filters.categoryId }),
    ...(filters.status === 'all' ? {} : { status: filters.status }),
  };
}

/**
 * Quantos filtros estão valendo.
 *
 * `all` não conta, porque não e um recorte: e a ausência dele. A página
 * também não — ela e onde a pessoa esta, e não o que ela pediu.
 */
export function activeProductFilterCount(filters: ProductFilters): number {
  return (
    (filters.q === '' ? 0 : 1) +
    (filters.categoryId === '' ? 0 : 1) +
    (filters.status === 'all' ? 0 : 1)
  );
}

/** Um recorte novo, sempre de volta a primeira página. */
export function withProductFilter(
  filters: ProductFilters,
  patch: Partial<ProductFilters>,
): ProductFilters {
  // Mudar de categoria estando na página 4 e pedir um recorte que talvez
  // tenha uma só: sem este reset, a resposta e uma lista vazia que parece
  // "não há produtos nesta categoria".
  const page = patch.page ?? 1;

  return { ...filters, ...patch, page };
}
