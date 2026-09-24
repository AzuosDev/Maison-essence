import { expect, test } from 'vitest';
import { bestInterestFreeInstallment, buildInstallmentOptions, priceTotal } from './installments';
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

/* ---- A lista inteira, com juros ---------------------------------------------- */

/**
 * `buildInstallmentOptions` e o que o painel mostra a dona quando ela mexe
 * nos juros, e o que o checkout oferece ao cliente. Os numeros abaixo sao os
 * do backend: se um dia divergirem, e porque uma das duas contas mudou.
 */

test('a lista comeca no a vista e vai ate o maximo', () => {
  const options = buildInstallmentOptions(30000, CARD);

  expect(options[0]?.count).toBe(1);
  expect(options.at(-1)?.count).toBe(12);
  expect(options).toHaveLength(12);
});

test('ate o limite sem juros, o total nao muda', () => {
  const options = buildInstallmentOptions(30000, CARD);

  expect(options[2]).toEqual({
    count: 3,
    installmentCents: 10000,
    firstInstallmentCents: 10000,
    totalCents: 30000,
    hasInterest: false,
  });

  expect(options[5]?.totalCents).toBe(30000);
});

test('acima do limite, a tabela price entra e o total sobe', () => {
  const options = buildInstallmentOptions(30000, CARD);

  // R$ 300 em 7x a 1,99% ao mes. Mesmos centavos do backend.
  expect(options[6]).toEqual({
    count: 7,
    installmentCents: 4633,
    firstInstallmentCents: 4637,
    totalCents: 32435,
    hasInterest: true,
  });
});

test('a soma das parcelas e exatamente o total, em toda opcao', () => {
  // E o que a primeira parcela maior existe para garantir. Uma soma que nao
  // fecha vira discussao com o cliente na hora de cobrar.
  for (const option of buildInstallmentOptions(30000, CARD)) {
    const rest = option.installmentCents * (option.count - 1);

    expect(option.firstInstallmentCents + rest).toBe(option.totalCents);
  }
});

test('a parcela minima corta as opcoes de baixo, mas nunca o a vista', () => {
  // R$ 90: em 5x a parcela seria R$ 18, abaixo do minimo de R$ 20.
  const options = buildInstallmentOptions(9000, CARD);

  expect(options.map((option) => option.count)).toEqual([1, 2, 3, 4]);
});

test('o a vista sobrevive a um pedido menor que a parcela minima', () => {
  // Recusar R$ 15 no cartao porque o minimo de parcela e R$ 20 seria recusar
  // a venda: a regra existe para impedir "12x de R$ 1,25".
  const options = buildInstallmentOptions(1500, CARD);

  expect(options).toHaveLength(1);
  expect(options[0]?.installmentCents).toBe(1500);
});

test('sem juros cadastrados, nada e financiado', () => {
  const semJuros: PublicCard = { ...CARD, monthlyInterestPercent: 0 };

  for (const option of buildInstallmentOptions(30000, semJuros)) {
    expect(option.hasInterest).toBe(false);
    expect(option.totalCents).toBe(30000);
  }
});

test('a tabela price devolve o valor a vista quando a taxa e zero', () => {
  // A formula viraria `0 / 0`. Quem chamar de fora merece o valor, e nao um
  // `NaN` que so aparece tres somas adiante.
  expect(priceTotal(30000, 10, 0)).toBe(30000);
});
