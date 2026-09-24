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
 * Três coisas erram em silêncio aqui, e são as três que estes casos cobram:
 * um endereço adulterado que vira consulta inválida, um fuso que perde os
 * pedidos da noite, e uma página que não volta ao início quando o filtro
 * muda — o defeito que faz a lista aparecer vazia e a dona concluir que não
 * vendeu nada.
 */

/* ---- O que o endereço diz ------------------------------------------------ */

test('lê o recorte que o endereço descreve', () => {
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

test('endereço vazio e o recorte vazio', () => {
  expect(readOrderFilters(new URLSearchParams())).toEqual(EMPTY_ORDER_FILTERS);
});

test('status desconhecido vira qualquer status', () => {
  // Alguém traduziu o valor a mão, ou colou um endereço de uma versão
  // anterior. O resultado precisa ser a lista inteira, e não um filtro que
  // o backend recusa com 400.
  expect(readOrderFilters(new URLSearchParams('status=ENTREGUE')).status).toBe('');
});

test('data mal formada e ignorada', () => {
  const filters = readOrderFilters(new URLSearchParams('from=ontem&to=30/09/2026'));

  expect(filters.from).toBe('');
  expect(filters.to).toBe('');
});

test('página inválida volta a ser a primeira', () => {
  expect(readOrderFilters(new URLSearchParams('page=0')).page).toBe(1);
  expect(readOrderFilters(new URLSearchParams('page=-4')).page).toBe(1);
  expect(readOrderFilters(new URLSearchParams('page=abc')).page).toBe(1);
});

/* ---- O que o endereço escreve -------------------------------------------- */

test('o que esta vazio não entra no endereço', () => {
  expect(orderFiltersToSearch(EMPTY_ORDER_FILTERS)).toEqual({});
});

test('a primeira página também não entra', () => {
  const search = orderFiltersToSearch({ ...EMPTY_ORDER_FILTERS, status: ORDER_STATUSES.SHIPPED });

  expect(search).toEqual({ status: 'SHIPPED' });
});

test('ida e volta pelo endereço preserva o recorte', () => {
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

test('campo vazio não viaja para a API', () => {
  const params = orderListParams(EMPTY_ORDER_FILTERS);

  expect(params.q).toBeUndefined();
  expect(params.status).toBeUndefined();
  expect(params.from).toBeUndefined();
  expect(params.to).toBeUndefined();
  expect(params.page).toBe(1);
});

test('o período vira instante no fuso de quem esta olhando', () => {
  const params = orderListParams({ ...EMPTY_ORDER_FILTERS, from: '2026-09-22', to: '2026-09-22' });

  // Sem a conversão, `2026-09-22` viraria meia-noite UTC — e o pedido das
  // 22h do dia 21 em Fortaleza cairia dentro do filtro de "a partir do dia
  // 22". O instante precisa ser a meia-noite local.
  expect(new Date(String(params.from)).getHours()).toBe(0);
  expect(new Date(String(params.from)).getDate()).toBe(22);

  // E o fim do dia e o dia inteiro: "até 22/09" inclui o pedido das 23h50.
  expect(new Date(String(params.to)).getHours()).toBe(23);
  expect(new Date(String(params.to)).getDate()).toBe(22);
});

/* ---- Mudar de recorte ----------------------------------------------------- */

test('mudar um filtro devolve a primeira página', () => {
  const current = { ...EMPTY_ORDER_FILTERS, page: 4 };

  expect(withFilter(current, { status: ORDER_STATUSES.DELIVERED }).page).toBe(1);
});

test('mudar de página não mexe no resto', () => {
  const current = { ...EMPTY_ORDER_FILTERS, q: 'ME-26', page: 1 };
  const next = withFilter(current, { page: 3 });

  expect(next).toEqual({ ...current, page: 3 });
});

test('a contagem de filtros ignora a página', () => {
  expect(activeFilterCount({ ...EMPTY_ORDER_FILTERS, page: 7 })).toBe(0);
  expect(
    activeFilterCount({ ...EMPTY_ORDER_FILTERS, q: 'ME', status: ORDER_STATUSES.CONFIRMED }),
  ).toBe(2);
});
