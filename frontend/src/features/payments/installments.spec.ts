import { expect, test } from 'vitest';
import { bestInterestFreeInstallment } from './installments';
import type { PublicCard } from './payments.types';

/**
 * A linha de parcelamento do card.
 *
 * O que estes casos protegem e a igualdade com o backend: a parcela anunciada
 * na vitrine precisa ser a mesma que o checkout vai oferecer. Um `round` no
 * lugar do `floor` passa despercebido na tela e so aparece quando o cliente
 * soma as parcelas na calculadora.
 */

const CARD: PublicCard = {
  maxInstallments: 12,
  interestFreeUpTo: 6,
  monthlyInterestPercent: 1.99,
  minInstallmentCents: 2000,
};

test('escolhe o maior numero de parcelas que cabe no minimo', () => {
  // R$ 180 em 6x da R$ 30, acima do minimo de R$ 20.
  expect(bestInterestFreeInstallment(18000, CARD)).toEqual({
    count: 6,
    installmentCents: 3000,
  });
});

test('desce as parcelas ate respeitar o valor minimo', () => {
  // R$ 75: 6x daria R$ 12,50 e 3x da R$ 25 — o primeiro degrau que passa.
  expect(bestInterestFreeInstallment(7500, CARD)).toEqual({
    count: 3,
    installmentCents: 2500,
  });
});

test('nao parcela quando nem 2x alcanca o minimo', () => {
  expect(bestInterestFreeInstallment(3000, CARD)).toBeNull();
});

test('arredonda para baixo, como o backend', () => {
  // R$ 100 em 3x: R$ 33,33 e nao R$ 33,34. A sobra de um centavo vai para a
  // primeira parcela, que e conta do checkout — o card so mostra a repetida.
  const tresVezes: PublicCard = { ...CARD, interestFreeUpTo: 3 };

  expect(bestInterestFreeInstallment(10000, tresVezes)?.installmentCents).toBe(3333);
});

test('nao passa do teto de parcelas da loja', () => {
  // Sem juros ate 6x, mas a loja so aceita 3 no total.
  const limitado: PublicCard = { ...CARD, maxInstallments: 3 };

  expect(bestInterestFreeInstallment(18000, limitado)?.count).toBe(3);
});

test('loja que nao parcela nao anuncia parcela', () => {
  const avista: PublicCard = { ...CARD, interestFreeUpTo: 1 };

  expect(bestInterestFreeInstallment(18000, avista)).toBeNull();
});
