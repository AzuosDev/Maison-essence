import { expect, test } from 'vitest';
import type { AdminDeliveryCity } from './admin.types';
import {
  changesOf,
  draftFromCity,
  draftToCreate,
  emptyCityDraft,
  estimatedLabel,
  hasCityErrors,
  validateCity,
  type CityDraft,
} from './delivery';

/**
 * A tabela de taxas.
 *
 * O que erra em silencio aqui e caro de um jeito direto: uma taxa lida um
 * centavo errado cobra errado de todo mundo, e um `null` confundido com zero
 * apaga a isencao de frete de uma cidade inteira sem que nada avise.
 */

function city(patch: Partial<AdminDeliveryCity> = {}): AdminDeliveryCity {
  return {
    id: 'c1',
    name: 'Sobral',
    state: 'CE',
    feeCents: 1500,
    estimatedDays: 2,
    minOrderForFreeCents: null,
    isActive: true,
    order: 0,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

function draft(patch: Partial<CityDraft> = {}): CityDraft {
  return { name: 'Sobral', state: 'CE', fee: '15,00', days: '2', freeFrom: '', ...patch };
}

/* ---- Abrir uma cidade salva ------------------------------------------------ */

test('a taxa salva volta como texto editável', () => {
  expect(draftFromCity(city()).fee).toBe('15,00');
  expect(draftFromCity(city()).days).toBe('2');
});

test('sem regra própria de frete grátis, o campo fica vazio', () => {
  // `0,00` seria "frete gratis em qualquer pedido", que e outra coisa.
  expect(draftFromCity(city({ minOrderForFreeCents: null })).freeFrom).toBe('');
  expect(draftFromCity(city({ minOrderForFreeCents: 15_000 })).freeFrom).toBe('150,00');
});

test('a cidade nova começa com um dia de prazo', () => {
  expect(emptyCityDraft().days).toBe('1');
  expect(emptyCityDraft().fee).toBe('');
});

/* ---- A validacao ------------------------------------------------------------ */

test('um rascunho completo passa', () => {
  expect(hasCityErrors(validateCity(draft()))).toBe(false);
});

test('taxa zero passa; taxa em branco não', () => {
  // Zero e legitimo: e a cidade em que a loja entrega sem cobrar. Em branco
  // nao diz nada, e a cidade nao poderia entrar no checkout.
  expect(hasCityErrors(validateCity(draft({ fee: '0' })))).toBe(false);
  expect(validateCity(draft({ fee: '' })).fee).toBeDefined();
});

test('o estado precisa ser a sigla de duas letras', () => {
  expect(validateCity(draft({ state: 'Ceará' })).state).toBeDefined();
  expect(validateCity(draft({ state: 'C' })).state).toBeDefined();
  expect(validateCity(draft({ state: 'ce' })).state).toBeUndefined();
});

test('prazo em branco passa, e vale zero', () => {
  expect(hasCityErrors(validateCity(draft({ days: '' })))).toBe(false);
  expect(draftToCreate(draft({ days: '' })).estimatedDays).toBe(0);
});

test('prazo acima do teto barra', () => {
  expect(validateCity(draft({ days: '120' })).days).toBeDefined();
  expect(validateCity(draft({ days: '-1' })).days).toBeDefined();
});

test('frete grátis mal escrito barra, mas em branco não', () => {
  expect(validateCity(draft({ freeFrom: 'cem reais' })).freeFrom).toBeDefined();
  expect(validateCity(draft({ freeFrom: '' })).freeFrom).toBeUndefined();
});

/* ---- A saida ---------------------------------------------------------------- */

test('a taxa digitada vira centavos exatos', () => {
  // `19.99 * 100` daria `1998.9999...`, e a loja cobraria um centavo a menos
  // em toda entrega daquela cidade.
  expect(draftToCreate(draft({ fee: '19,99' })).feeCents).toBe(1999);
});

test('o estado sai em maiúscula', () => {
  expect(draftToCreate(draft({ state: 'ce' })).state).toBe('CE');
});

test('frete grátis em branco vira null, e não zero', () => {
  // `null` devolve a cidade a regra global da loja; zero daria frete gratis
  // em qualquer pedido, por menor que fosse.
  expect(draftToCreate(draft({ freeFrom: '' })).minOrderForFreeCents).toBeNull();
  expect(draftToCreate(draft({ freeFrom: '150,00' })).minOrderForFreeCents).toBe(15_000);
});

/* ---- O diff ------------------------------------------------------------------ */

test('sair do campo sem mudar nada não gera chamada', () => {
  expect(changesOf(draftFromCity(city()), city())).toBeNull();
});

test('só o campo alterado viaja', () => {
  expect(changesOf(draft({ fee: '18,00' }), city())).toEqual({ feeCents: 1800 });
});

test('escrever o estado em minúscula não conta como mudanca', () => {
  // O servidor grava em maiuscula e devolve assim. Sem esta normalizacao, a
  // linha reenviaria o mesmo valor a cada saida de campo, para sempre.
  expect(changesOf(draft({ state: 'ce' }), city({ state: 'CE' }))).toBeNull();
});

test('apagar o frete grátis manda null de proposito', () => {
  const salva = city({ minOrderForFreeCents: 15_000 });

  expect(changesOf(draft({ freeFrom: '' }), salva)).toEqual({ minOrderForFreeCents: null });
});

test('vários campos mudados viajam juntos', () => {
  expect(changesOf(draft({ fee: '20,00', days: '5' }), city())).toEqual({
    feeCents: 2000,
    estimatedDays: 5,
  });
});

/* ---- A frase do checkout ------------------------------------------------------ */

test('o prazo vira a mesma frase que a cliente le', () => {
  // Copia fiel de `estimatedLabelOf` do backend: o painel e o checkout
  // precisam escrever igual.
  expect(estimatedLabel(0)).toBe('No mesmo dia');
  expect(estimatedLabel(1)).toBe('Até 1 dia útil');
  expect(estimatedLabel(3)).toBe('Até 3 dias úteis');
});
