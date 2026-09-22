import { expect, test } from 'vitest';
import {
  EMPTY_FILTERS,
  apiParamsFrom,
  clearedFilters,
  countActiveFilters,
  filtersFromSearch,
  searchFromFilters,
  type CatalogFilters,
} from './catalog.filters';

/**
 * A ponte entre a URL, o estado e a API.
 *
 * O criterio de aceite "aplicar tres filtros e recarregar a pagina mantem
 * tudo aplicado" e, no fundo, uma afirmacao sobre estas funcoes: recarregar
 * nao restaura nada, apenas le a URL de novo. Se a ida e a volta forem fieis,
 * o criterio vale — e nao ha tela que possa quebra-lo, porque nao existe um
 * segundo lugar onde o filtro pudesse estar guardado.
 *
 * O outro grupo de casos protege a tradutora para a API: o backend valida a
 * query com `forbidNonWhitelisted`, entao um parametro em portugues que
 * vazasse daqui nao seria ignorado — seria um 400 e uma vitrine vazia.
 */

function filtros(patch: Partial<CatalogFilters> = {}): CatalogFilters {
  return { ...EMPTY_FILTERS, ...patch };
}

/* ---- Ida e volta ------------------------------------------------------- */

test('tres filtros sobrevivem a ida e volta pela URL', () => {
  const aplicados = filtros({
    brand: 'Lattafa',
    minCents: 10_000,
    maxCents: 50_000,
    inStock: true,
  });

  const url = searchFromFilters(aplicados);

  // E isto que o navegador guarda e que uma recarga le de volta.
  expect(url.toString()).toBe('marca=Lattafa&min=100&max=500&estoque=1');
  expect(filtersFromSearch(url)).toEqual(aplicados);
});

test('a URL de um catalogo sem filtro fica limpa', () => {
  expect(searchFromFilters(EMPTY_FILTERS).toString()).toBe('');
});

test('a pagina 1 nao aparece na URL, e as outras sim', () => {
  expect(searchFromFilters(filtros({ page: 1 })).toString()).toBe('');
  expect(searchFromFilters(filtros({ page: 3 })).toString()).toBe('pagina=3');
});

test('a busca com filtro tambem volta inteira', () => {
  const busca = filtros({ q: 'oud', brand: 'Lattafa', onSale: true, sort: 'menor-preco' });

  expect(filtersFromSearch(searchFromFilters(busca))).toEqual(busca);
});

/* ---- URL estragada ----------------------------------------------------- */

test('valor invalido vira ausencia, e nao erro', () => {
  const lixo = new URLSearchParams('min=abc&max=-5&pagina=zero&ordem=preco');

  expect(filtersFromSearch(lixo)).toEqual(EMPTY_FILTERS);
});

test('faixa invertida e descartada em vez de virar lista vazia', () => {
  // `min` acima de `max` nao e um filtro estreito: e um filtro impossivel.
  const invertida = filtersFromSearch(new URLSearchParams('min=500&max=100'));

  expect(invertida.minCents).toBeNull();
  expect(invertida.maxCents).toBeNull();
});

/* ---- Traducao para a API ----------------------------------------------- */

test('a API recebe os nomes dela, e nenhum em portugues', () => {
  const params = apiParamsFrom(
    filtros({ brand: 'Lattafa', minCents: 10_000, inStock: true, sort: 'menor-preco', page: 2 }),
  );

  expect(params).toEqual({
    brand: 'Lattafa',
    minPrice: 10_000,
    inStock: true,
    sort: 'price_asc',
    page: 2,
    limit: 24,
  });
});

test('bandeira desligada nao viaja', () => {
  // Para o backend, `readyToShip=false` quer dizer "tanto faz" — mandar o
  // campo a toa so engorda a chave de cache.
  expect(apiParamsFrom(EMPTY_FILTERS)).toEqual({ limit: 24 });
});

test('a rota impoe a categoria e a bandeira', () => {
  const params = apiParamsFrom(EMPTY_FILTERS, { category: 'amadeirados', readyToShip: true });

  expect(params.category).toBe('amadeirados');
  expect(params.readyToShip).toBe(true);
});

test('o filtro de desconto vira uma varredura ordenada por desconto', () => {
  // Nao existe "so com desconto" em `GET /products`. A vitrine pede a pagina
  // cheia ja ordenada por desconto e recorta no cliente.
  const params = apiParamsFrom(filtros({ onSale: true, sort: 'nome', page: 3 }));

  expect(params).toEqual({ sort: 'discount', page: 1, limit: 48 });
});

/* ---- Contagem e limpeza ------------------------------------------------- */

test('a faixa de preco conta como um filtro, com uma ou com duas pontas', () => {
  expect(countActiveFilters(filtros({ minCents: 10_000 }))).toBe(1);
  expect(countActiveFilters(filtros({ minCents: 10_000, maxCents: 50_000 }))).toBe(1);
});

test('o que a rota impos nao conta como filtro aplicado', () => {
  // Em `/pronta-entrega`, a bandeira e o endereco da pagina: nao ha o que
  // desmarcar, e o botao "limpar filtros (1)" seria uma promessa falsa.
  const emRota = filtros({ readyToShip: true });

  expect(countActiveFilters(emRota, { readyToShip: true })).toBe(0);
  expect(countActiveFilters(emRota)).toBe(1);
});

test('limpar filtros preserva o termo buscado e a ordem', () => {
  const limpo = clearedFilters(filtros({ q: 'oud', sort: 'nome', brand: 'Lattafa', page: 4 }));

  expect(limpo).toEqual(filtros({ q: 'oud', sort: 'nome' }));
});
