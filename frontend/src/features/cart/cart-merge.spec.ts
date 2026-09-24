// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { clearStashedCart, mergeCartLines, readStashedCart, writeStashedCart } from './cart-merge';
import { MAX_LINE_QUANTITY, type CartLine } from './cart.types';

/**
 * A mescla de sacolas, que e a conta do login.
 *
 * Somar quantidade parece trivial até a primeira sacola em que o mesmo
 * perfume aparece em dois tamanhos: aí a diferença entre "mesma linha" e
 * "linha diferente" decide se o cliente leva dois frascos ou quatro. Os
 * casos abaixo são essa diferença, mais o que chega do `localStorage`, que e
 * texto que qualquer coisa pode ter escrito.
 */

function linha(overrides: Partial<CartLine> = {}): CartLine {
  return { productId: 'p1', variantId: 'v50', quantity: 1, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});

test('a mesma variante soma; variantes diferentes são linhas diferentes', () => {
  const guardada = [linha({ quantity: 2 }), linha({ variantId: 'v100', quantity: 1 })];
  const agora = [linha({ quantity: 3 })];

  expect(mergeCartLines(guardada, agora)).toEqual([
    { productId: 'p1', variantId: 'v50', quantity: 5 },
    { productId: 'p1', variantId: 'v100', quantity: 1 },
  ]);
});

test('a guardada fica em cima e o que entrou nesta visita vem depois', () => {
  const guardada = [linha({ productId: 'antigo', variantId: 'va' })];
  const agora = [linha({ productId: 'novo', variantId: 'vn' })];

  expect(mergeCartLines(guardada, agora).map((item) => item.productId)).toEqual(['antigo', 'novo']);
});

test('a soma respeita o teto por linha', () => {
  const merged = mergeCartLines(
    [linha({ quantity: MAX_LINE_QUANTITY })],
    [linha({ quantity: 50 })],
  );

  expect(merged[0]?.quantity).toBe(MAX_LINE_QUANTITY);
});

test('nenhuma das duas sacolas e alterada no lugar', () => {
  const guardada = [linha({ quantity: 2 })];

  mergeCartLines(guardada, [linha({ quantity: 3 })]);

  expect(guardada[0]?.quantity).toBe(2);
});

/* ---- O que vai e volta do armazenamento --------------------------------- */

test('a sacola guardada volta com os três campos, e só eles', () => {
  writeStashedCart('cliente-1', [linha({ quantity: 2 })]);

  expect(readStashedCart('cliente-1')).toEqual([
    { productId: 'p1', variantId: 'v50', quantity: 2 },
  ]);
});

test('cada cliente tem a sua, e uma não vê a da outra', () => {
  writeStashedCart('cliente-1', [linha()]);

  expect(readStashedCart('cliente-2')).toEqual([]);
});

/**
 * O caso que este módulo existe para conter.
 *
 * Uma versão anterior desta loja guardava `unitPriceCents` na linha, e essas
 * sacolas continuam no navegador de quem comprou antes. O preço de lá não
 * pode atravessar a leitura — ele tem semanas e não vale nada.
 */
test('preço vindo de uma sacola antiga e descartado na leitura', () => {
  localStorage.setItem(
    'maison-essence.cart.customer.cliente-1',
    JSON.stringify([{ productId: 'p1', variantId: 'v50', quantity: 1, unitPriceCents: 18990 }]),
  );

  const [item] = readStashedCart('cliente-1');

  expect(item).toEqual({ productId: 'p1', variantId: 'v50', quantity: 1 });
  expect(item).not.toHaveProperty('unitPriceCents');
});

test('entrada corrompida vira sacola vazia em vez de quebrar o login', () => {
  localStorage.setItem('maison-essence.cart.customer.cliente-1', '{não e json');

  expect(readStashedCart('cliente-1')).toEqual([]);
});

test('linha sem id ou com quantidade inválida e descartada', () => {
  localStorage.setItem(
    'maison-essence.cart.customer.cliente-1',
    JSON.stringify([
      { productId: '', variantId: 'v50', quantity: 1 },
      { productId: 'p1', variantId: 'v50', quantity: 0 },
      { productId: 'p2', variantId: 'v50', quantity: 2 },
    ]),
  );

  expect(readStashedCart('cliente-1')).toEqual([
    { productId: 'p2', variantId: 'v50', quantity: 2 },
  ]);
});

test('guardar uma sacola vazia apaga o registro', () => {
  writeStashedCart('cliente-1', [linha()]);
  writeStashedCart('cliente-1', []);

  expect(localStorage.getItem('maison-essence.cart.customer.cliente-1')).toBeNull();
});

test('clearStashedCart esquece a sacola daquele cliente', () => {
  writeStashedCart('cliente-1', [linha()]);
  clearStashedCart('cliente-1');

  expect(readStashedCart('cliente-1')).toEqual([]);
});

test('armazenamento bloqueado não derruba a escrita', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });

  expect(() => {
    writeStashedCart('cliente-1', [linha()]);
  }).not.toThrow();

  setItem.mockRestore();
});
