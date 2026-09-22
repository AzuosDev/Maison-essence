// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import {
  PRICE_NOTICE_MIN_AGE_MS,
  forgetPrices,
  pricesChangedSince,
  readPriceSnapshot,
  writePriceSnapshot,
} from './price-watch';
import type { QuoteLine } from './quote.types';

/**
 * O aviso de reajuste, e os tres jeitos de erra-lo.
 *
 * Avisar quando nada mudou faz o cliente desconfiar do preco que esta
 * lendo. Avisar a cada recarga vira ruido e ensina a ignorar. E nao avisar
 * quando mudou e a razao de o requisito existir. Os casos abaixo prendem os
 * tres.
 *
 * O que nenhum deles pode encontrar e um valor em reais no `localStorage` —
 * o ultimo caso confere isso diretamente.
 */

const UMA_HORA_E_MEIA = PRICE_NOTICE_MIN_AGE_MS * 1.5;

/**
 * O que `useCartQuote` faz a cada cotacao, em uma linha: le o retrato de
 * antes, compara, e grava o de agora. Devolve se ha o que avisar.
 */
function anotar(items: QuoteLine[], now = Date.now()): boolean {
  const before = readPriceSnapshot();
  const changed = pricesChangedSince(before, items, now);

  writePriceSnapshot(items, now);

  return changed;
}

function item(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    productId: 'p1',
    variantId: 'v50',
    productName: 'Asad',
    productSlug: 'asad',
    variantLabel: '50ml',
    image: '',
    quantity: 1,
    unitPriceCents: 18990,
    availableStock: 5,
    allowBackorder: false,
    discountPercent: 0,
    discountCents: 0,
    lineTotalCents: 18990,
    unavailable: false,
    unavailableReason: '',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

test('a primeira sacola deste navegador nunca avisa', () => {
  expect(anotar([item()])).toBe(false);
});

test('preco diferente depois de dias avisa', () => {
  const agora = Date.now();

  anotar([item({ unitPriceCents: 18990 })], agora);

  expect(anotar([item({ unitPriceCents: 21990 })], agora + UMA_HORA_E_MEIA)).toBe(true);
});

test('o mesmo preco depois de dias nao avisa', () => {
  const agora = Date.now();

  anotar([item()], agora);

  expect(anotar([item()], agora + UMA_HORA_E_MEIA)).toBe(false);
});

/**
 * A carencia existe para este caso: recarregar a pagina, ou ter duas abas
 * abertas, nao pode virar um aviso a cada leitura.
 */
test('mudanca recente e anotada em silencio', () => {
  const agora = Date.now();

  anotar([item({ unitPriceCents: 18990 })], agora);

  expect(anotar([item({ unitPriceCents: 21990 })], agora + 60_000)).toBe(false);
});

/**
 * O erro que um digest unico do carrinho inteiro cometeria: acrescentar um
 * perfume mudaria a impressao digital da sacola, e "voce adicionou um item"
 * viraria "os precos mudaram".
 */
test('adicionar um item novo nao e reajuste', () => {
  const agora = Date.now();

  anotar([item()], agora);

  const comItemNovo = [item(), item({ productId: 'p2', variantId: 'v9', unitPriceCents: 9990 })];

  expect(anotar(comItemNovo, agora + UMA_HORA_E_MEIA)).toBe(false);
});

test('remover um item tambem nao e reajuste', () => {
  const agora = Date.now();

  anotar([item(), item({ productId: 'p2', variantId: 'v9' })], agora);

  expect(anotar([item()], agora + UMA_HORA_E_MEIA)).toBe(false);
});

/**
 * A linha indisponivel volta da cotacao com preco zero. Anotar esse zero
 * faria o produto reativado depois parecer um reajuste.
 */
test('item indisponivel fica fora da anotacao', () => {
  const agora = Date.now();

  anotar([item({ unavailable: true, unitPriceCents: 0 })], agora);

  expect(anotar([item({ unitPriceCents: 18990 })], agora + UMA_HORA_E_MEIA)).toBe(false);
});

test('forgetPrices apaga a anotacao', () => {
  const agora = Date.now();

  anotar([item({ unitPriceCents: 18990 })], agora);
  forgetPrices();

  expect(anotar([item({ unitPriceCents: 21990 })], agora + UMA_HORA_E_MEIA)).toBe(false);
});

/**
 * A regra da casa, conferida no proprio armazenamento.
 *
 * Nao basta o aviso funcionar: ele tem que funcionar sem deixar um preco
 * guardado para tras. `18990` nao pode aparecer em lugar nenhum do que foi
 * escrito.
 */
test('nenhum valor em reais e gravado', () => {
  anotar([item({ unitPriceCents: 18990 })]);

  const gravado = localStorage.getItem('maison-essence.cart.prices') ?? '';

  expect(gravado).not.toContain('18990');
  expect(gravado).not.toContain('189.90');
  expect(gravado).not.toContain('unitPriceCents');
});
