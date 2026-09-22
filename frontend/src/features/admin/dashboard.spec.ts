import { expect, test } from 'vitest';
import { ORDER_STATUSES, type AdminOrderSummary, type AdminProduct, type AdminVariant } from './admin.types';
import { countSince, lowStock, outOfStock, revenueOf, startOfMonth, startOfToday } from './dashboard';

/**
 * As contas da abertura do painel.
 *
 * Elas existem porque a API nao tem rota de metricas, e sao o tipo de codigo
 * que erra em silencio: um status somado a mais infla o faturamento, um fuso
 * trocado conta o pedido das 23h como de amanha, e ninguem descobre — o
 * numero continua parecendo um numero.
 */

function order(patch: Partial<AdminOrderSummary> = {}): AdminOrderSummary {
  return {
    id: '1',
    code: 'ME-260922-AAA1',
    status: ORDER_STATUSES.CONFIRMED,
    customerName: 'Cliente',
    phone: '88999998888',
    phoneLabel: '(88) 99999-8888',
    mode: 'DELIVERY',
    itemCount: 1,
    totalCents: 10_000,
    createdAt: '2026-09-22T12:00:00.000Z',
    ...patch,
  };
}

function variant(patch: Partial<AdminVariant> = {}): AdminVariant {
  return {
    id: 'v1',
    sku: 'ASA-100',
    label: '100ml',
    priceCents: 18_990,
    compareAtPriceCents: null,
    discountPercent: 0,
    stock: 10,
    image: '',
    isActive: true,
    allowBackorder: false,
    isAvailable: true,
    ...patch,
  };
}

function product(patch: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: 'p1',
    name: 'Asad',
    slug: 'asad',
    description: '',
    brand: 'Lattafa',
    categoryIds: [],
    images: [],
    coverImage: '',
    variants: [variant()],
    hasVariants: true,
    priceRangeCents: { min: 18_990, max: 18_990 },
    discountPercent: 0,
    inStock: true,
    totalStock: 10,
    isActive: true,
    isFeatured: false,
    isReadyToShip: true,
    tags: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

/* ---- Faturamento -------------------------------------------------------- */

test('o faturamento conta so a venda fechada', () => {
  const cents = revenueOf([
    order({ status: ORDER_STATUSES.CONFIRMED, totalCents: 10_000 }),
    order({ status: ORDER_STATUSES.PREPARING, totalCents: 20_000 }),
    order({ status: ORDER_STATUSES.SHIPPED, totalCents: 5_000 }),
    order({ status: ORDER_STATUSES.DELIVERED, totalCents: 5_000 }),
    // Estes dois ficam de fora: um ainda nao virou conversa, o outro morreu.
    order({ status: ORDER_STATUSES.PENDING_CONTACT, totalCents: 90_000 }),
    order({ status: ORDER_STATUSES.CANCELLED, totalCents: 90_000 }),
  ]).cents;

  expect(cents).toBe(40_000);
});

test('o faturacao vazio e zero, e nao um erro', () => {
  expect(revenueOf([]).cents).toBe(0);
});

test('a soma avisa quando parou na primeira pagina', () => {
  expect(revenueOf([order()], true).truncated).toBe(true);
  expect(revenueOf([order()]).truncated).toBe(false);
});

/* ---- Pedidos de hoje ---------------------------------------------------- */

test('os pedidos de hoje sao os que vieram depois da meia-noite', () => {
  const since = '2026-09-22T03:00:00.000Z';

  const count = countSince(
    [
      order({ createdAt: '2026-09-22T14:00:00.000Z' }),
      order({ createdAt: '2026-09-22T03:00:00.000Z' }),
      // Ontem, no fuso de quem esta olhando.
      order({ createdAt: '2026-09-22T02:59:59.000Z' }),
      order({ createdAt: '2026-09-21T23:00:00.000Z' }),
    ],
    since,
  );

  expect(count).toBe(2);
});

test('a meia-noite e a do fuso local, e nao a de UTC', () => {
  // As 23h de 22/09 no fuso de quem esta olhando: a meia-noite daquele dia
  // precisa ficar antes disso, qualquer que seja o fuso da maquina.
  const now = new Date(2026, 8, 22, 23, 0, 0);

  expect(startOfToday(now) <= now.toISOString()).toBe(true);
  expect(new Date(startOfToday(now)).getDate()).toBe(22);
  expect(new Date(startOfMonth(now)).getDate()).toBe(1);
});

/* ---- Estoque ------------------------------------------------------------ */

test('sem estoque conta so o que esta publicado', () => {
  const esgotados = outOfStock([
    product({ id: 'a', inStock: false }),
    product({ id: 'b', inStock: true }),
    // Despublicado nao conta: nao esta na vitrine para faltar.
    product({ id: 'c', inStock: false, isActive: false }),
  ]);

  expect(esgotados.map((item) => item.id)).toEqual(['a']);
});

test('o estoque baixo e por variante, da mais urgente para a menos', () => {
  const lines = lowStock([
    product({
      id: 'p1',
      variants: [variant({ id: 'v1', stock: 3 }), variant({ id: 'v2', stock: 1 })],
    }),
    product({ id: 'p2', variants: [variant({ id: 'v3', stock: 10 })] }),
  ]);

  expect(lines.map((line) => line.variant.id)).toEqual(['v2', 'v1']);
});

test('sob encomenda, desativada e zerada ficam fora do aviso', () => {
  const lines = lowStock([
    product({
      variants: [
        // Sob encomenda nao tem estoque a repor.
        variant({ id: 'sob', stock: 1, allowBackorder: true }),
        // Desativada nao esta a venda.
        variant({ id: 'off', stock: 1, isActive: false }),
        // Zerada nao esta "acabando": ja acabou, e e outro aviso.
        variant({ id: 'zero', stock: 0 }),
      ],
    }),
  ]);

  expect(lines).toEqual([]);
});
