import { expect, test } from 'vitest';
import {
  EMPTY_PRODUCT_FILTERS,
  activeProductFilterCount,
  productFiltersToSearch,
  productListParams,
  readProductFilters,
  withProductFilter,
} from './product-filters';

/**
 * O recorte do catalogo.
 *
 * Os mesmos tres riscos do recorte de pedidos — endereco adulterado virando
 * consulta invalida, pagina que nao volta ao inicio, filtro invisivel — com
 * um eixo a mais: a categoria, que chega como id e nao pode ser mandada ao
 * servidor sem conferir a forma.
 */

const ID = '68d1f2a3c4b5e6f708192a3b';

test('le o recorte que o endereco descreve', () => {
  const filters = readProductFilters(
    new URLSearchParams(`q=asad&categoria=${ID}&status=inactive&page=2`),
  );

  expect(filters).toEqual({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });
});

test('endereco vazio e o recorte padrao', () => {
  expect(readProductFilters(new URLSearchParams())).toEqual(EMPTY_PRODUCT_FILTERS);
});

test('categoria que nao tem forma de id e ignorada', () => {
  // `@IsMongoId` recusaria com 400, e a lista inteira sumiria por causa de um
  // endereco colado torto.
  expect(readProductFilters(new URLSearchParams('categoria=masculino')).categoryId).toBe('');
  expect(readProductFilters(new URLSearchParams('categoria=123')).categoryId).toBe('');
});

test('status desconhecido volta a ser todos', () => {
  expect(readProductFilters(new URLSearchParams('status=publicado')).status).toBe('all');
});

test('pagina invalida volta a ser a primeira', () => {
  expect(readProductFilters(new URLSearchParams('page=0')).page).toBe(1);
  expect(readProductFilters(new URLSearchParams('page=abc')).page).toBe(1);
});

test('o que esta no padrao nao entra no endereco', () => {
  expect(productFiltersToSearch(EMPTY_PRODUCT_FILTERS)).toEqual({});
  expect(productFiltersToSearch({ ...EMPTY_PRODUCT_FILTERS, status: 'all', page: 1 })).toEqual({});
});

test('ida e volta pelo endereco preserva o recorte', () => {
  const filters = { q: 'lattafa', categoryId: ID, status: 'active' as const, page: 3 };

  expect(readProductFilters(new URLSearchParams(productFiltersToSearch(filters)))).toEqual(filters);
});

test('campo vazio nao viaja para a API', () => {
  const params = productListParams(EMPTY_PRODUCT_FILTERS);

  expect(params.q).toBeUndefined();
  expect(params.categoryId).toBeUndefined();
  // `all` e a ausencia de filtro, e nao um valor a mandar.
  expect(params.status).toBeUndefined();
});

test('o recorte cheio chega inteiro na API', () => {
  const params = productListParams({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });

  expect(params).toMatchObject({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });
});

test('mudar um filtro devolve a primeira pagina', () => {
  const current = { ...EMPTY_PRODUCT_FILTERS, page: 5 };

  expect(withProductFilter(current, { status: 'active' }).page).toBe(1);
});

test('mudar de pagina nao mexe no resto', () => {
  const current = { ...EMPTY_PRODUCT_FILTERS, q: 'asad' };

  expect(withProductFilter(current, { page: 4 })).toEqual({ ...current, page: 4 });
});

test('todos nao conta como filtro, e a pagina tambem nao', () => {
  expect(activeProductFilterCount({ ...EMPTY_PRODUCT_FILTERS, page: 9 })).toBe(0);
  expect(activeProductFilterCount({ q: 'asad', categoryId: ID, status: 'active', page: 1 })).toBe(
    3,
  );
});
