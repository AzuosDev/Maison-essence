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
 * O recorte do catálogo.
 *
 * Os mesmos três riscos do recorte de pedidos — endereço adulterado virando
 * consulta inválida, página que não volta ao início, filtro invisível — com
 * um eixo a mais: a categoria, que chega como id e não pode ser mandada ao
 * servidor sem conferir a forma.
 */

const ID = '68d1f2a3c4b5e6f708192a3b';

test('lê o recorte que o endereço descreve', () => {
  const filters = readProductFilters(
    new URLSearchParams(`q=asad&categoria=${ID}&status=inactive&page=2`),
  );

  expect(filters).toEqual({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });
});

test('endereço vazio e o recorte padrão', () => {
  expect(readProductFilters(new URLSearchParams())).toEqual(EMPTY_PRODUCT_FILTERS);
});

test('categoria que não tem forma de id e ignorada', () => {
  // `@IsMongoId` recusaria com 400, e a lista inteira sumiria por causa de um
  // endereço colado torto.
  expect(readProductFilters(new URLSearchParams('categoria=masculino')).categoryId).toBe('');
  expect(readProductFilters(new URLSearchParams('categoria=123')).categoryId).toBe('');
});

test('status desconhecido volta a ser todos', () => {
  expect(readProductFilters(new URLSearchParams('status=publicado')).status).toBe('all');
});

test('página inválida volta a ser a primeira', () => {
  expect(readProductFilters(new URLSearchParams('page=0')).page).toBe(1);
  expect(readProductFilters(new URLSearchParams('page=abc')).page).toBe(1);
});

test('o que esta no padrão não entra no endereço', () => {
  expect(productFiltersToSearch(EMPTY_PRODUCT_FILTERS)).toEqual({});
  expect(productFiltersToSearch({ ...EMPTY_PRODUCT_FILTERS, status: 'all', page: 1 })).toEqual({});
});

test('ida e volta pelo endereço preserva o recorte', () => {
  const filters = { q: 'lattafa', categoryId: ID, status: 'active' as const, page: 3 };

  expect(readProductFilters(new URLSearchParams(productFiltersToSearch(filters)))).toEqual(filters);
});

test('campo vazio não viaja para a API', () => {
  const params = productListParams(EMPTY_PRODUCT_FILTERS);

  expect(params.q).toBeUndefined();
  expect(params.categoryId).toBeUndefined();
  // `all` e a ausência de filtro, e não um valor a mandar.
  expect(params.status).toBeUndefined();
});

test('o recorte cheio chega inteiro na API', () => {
  const params = productListParams({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });

  expect(params).toMatchObject({ q: 'asad', categoryId: ID, status: 'inactive', page: 2 });
});

test('mudar um filtro devolve a primeira página', () => {
  const current = { ...EMPTY_PRODUCT_FILTERS, page: 5 };

  expect(withProductFilter(current, { status: 'active' }).page).toBe(1);
});

test('mudar de página não mexe no resto', () => {
  const current = { ...EMPTY_PRODUCT_FILTERS, q: 'asad' };

  expect(withProductFilter(current, { page: 4 })).toEqual({ ...current, page: 4 });
});

test('todos não conta como filtro, e a página também não', () => {
  expect(activeProductFilterCount({ ...EMPTY_PRODUCT_FILTERS, page: 9 })).toBe(0);
  expect(activeProductFilterCount({ q: 'asad', categoryId: ID, status: 'active', page: 1 })).toBe(
    3,
  );
});
