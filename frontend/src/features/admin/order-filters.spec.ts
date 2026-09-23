import { expect, test } from 'vitest';
import { ORDER_STATUSES } from './admin.types';
import {
  EMPTY_ORDER_FILTERS,
  activeFilterCount,
  orderFiltersToSearch,
  orderListParams,
  readOrderFilters,
  withFilter,
} from './order-filters';

/**
 * O recorte da tela de pedidos.
 *
 * Tres coisas erram em silencio aqui, e sao as tres que estes casos cobram:
 * um endereco adulterado que vira consulta invalida, um fuso que perde os
 * pedidos da noite, e uma pagina que nao volta ao inicio quando o filtro
 * muda — o defeito que faz a lista aparecer vazia e a dona concluir que nao
 * vendeu nada.
 */

/* ---- O que o endereco diz ------------------------------------------------ */

test('le o recorte que o endereco descreve', () => {
  const filters = readOrderFilters(
    new URLSearchParams('q=ME-260922&status=CONFIRMED&from=2026-09-01&to=2026-09-30&page=3'),
  );

  expect(filters).toEqual({
    q: 'ME-260922',
    status: ORDER_STATUSES.CONFIRMED,
    from: '2026-09-01',
    to: '2026-09-30',
    page: 3,
  });
});

test('endereco vazio e o recorte vazio', () => {
  expect(readOrderFilters(new URLSearchParams())).toEqual(EMPTY_ORDER_FILTERS);
});

test('status desconhecido vira qualquer status', () => {
  // Alguem traduziu o valor a mao, ou colou um endereco de uma versao
  // anterior. O resultado precisa ser a lista inteira, e nao um filtro que
  // o backend recusa com 400.
  expect(readOrderFilters(new URLSearchParams('status=ENTREGUE')).status).toBe('');
});

test('data mal formada e ignorada', () => {
  const filters = readOrderFilters(new URLSearchParams('from=ontem&to=30/09/2026'));

  expect(filters.from).toBe('');
  expect(filters.to).toBe('');
});

test('pagina invalida volta a ser a primeira', () => {
  expect(readOrderFilters(new URLSearchParams('page=0')).page).toBe(1);
  expect(readOrderFilters(new URLSearchParams('page=-4')).page).toBe(1);
  expect(readOrderFilters(new URLSearchParams('page=abc')).page).toBe(1);
});

/* ---- O que o endereco escreve -------------------------------------------- */

test('o que esta vazio nao entra no endereco', () => {
  expect(orderFiltersToSearch(EMPTY_ORDER_FILTERS)).toEqual({});
});

test('a primeira pagina tambem nao entra', () => {
  const search = orderFiltersToSearch({ ...EMPTY_ORDER_FILTERS, status: ORDER_STATUSES.SHIPPED });

  expect(search).toEqual({ status: 'SHIPPED' });
});

test('ida e volta pelo endereco preserva o recorte', () => {
  const filters = {
    q: '88999998888',
    status: ORDER_STATUSES.PREPARING,
    from: '2026-09-01',
    to: '2026-09-30',
    page: 2,
  };

  expect(readOrderFilters(new URLSearchParams(orderFiltersToSearch(filters)))).toEqual(filters);
});

/* ---- O que a API recebe --------------------------------------------------- */

test('campo vazio nao viaja para a API', () => {
  const params = orderListParams(EMPTY_ORDER_FILTERS);

  expect(params.q).toBeUndefined();
  expect(params.status).toBeUndefined();
  expect(params.from).toBeUndefined();
  expect(params.to).toBeUndefined();
  expect(params.page).toBe(1);
});

test('o periodo vira instante no fuso de quem esta olhando', () => {
  const params = orderListParams({ ...EMPTY_ORDER_FILTERS, from: '2026-09-22', to: '2026-09-22' });

  // Sem a conversao, `2026-09-22` viraria meia-noite UTC — e o pedido das
  // 22h do dia 21 em Fortaleza cairia dentro do filtro de "a partir do dia
  // 22". O instante precisa ser a meia-noite local.
  expect(new Date(String(params.from)).getHours()).toBe(0);
  expect(new Date(String(params.from)).getDate()).toBe(22);

  // E o fim do dia e o dia inteiro: "ate 22/09" inclui o pedido das 23h50.
  expect(new Date(String(params.to)).getHours()).toBe(23);
  expect(new Date(String(params.to)).getDate()).toBe(22);
});

/* ---- Mudar de recorte ----------------------------------------------------- */

test('mudar um filtro devolve a primeira pagina', () => {
  const current = { ...EMPTY_ORDER_FILTERS, page: 4 };

  expect(withFilter(current, { status: ORDER_STATUSES.DELIVERED }).page).toBe(1);
});

test('mudar de pagina nao mexe no resto', () => {
  const current = { ...EMPTY_ORDER_FILTERS, q: 'ME-26', page: 1 };
  const next = withFilter(current, { page: 3 });

  expect(next).toEqual({ ...current, page: 3 });
});

test('a contagem de filtros ignora a pagina', () => {
  expect(activeFilterCount({ ...EMPTY_ORDER_FILTERS, page: 7 })).toBe(0);
  expect(
    activeFilterCount({ ...EMPTY_ORDER_FILTERS, q: 'ME', status: ORDER_STATUSES.CONFIRMED }),
  ).toBe(2);
});
