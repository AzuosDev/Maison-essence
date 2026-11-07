import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, test } from 'vitest';
import type { AppliedCoupon, CartQuote } from '@/features/cart';
import {
  COUPON_CODE_MAX,
  COUPON_CODE_MIN,
  canSubmitCoupon,
  couponActionLabel,
  couponReachLabel,
  couponStateOf,
  normalizeCouponCode,
} from './coupon';

/**
 * As regras da caixa do cupom.
 *
 * Testadas sem montar componente nenhum, porque o que elas decidem e o que não
 * pode errar: dizer "aplicado" quando não esta, ou "não e válido" para quem
 * ainda esta esperando a resposta, e prometer ou negar um desconto sem base.
 */

describe('o código, como a cliente o digita', () => {
  it('sobe para maiúsculas e tira o que o servidor não aceita', () => {
    expect(normalizeCouponCode(' black-friday! ')).toBe('BLACKFRIDAY');
  });

  it('para no tamanho máximo em vez de mandar um código que será cortado', () => {
    expect(normalizeCouponCode('A'.repeat(50))).toHaveLength(COUPON_CODE_MAX);
  });

  it('não manda código curto para o servidor recusar', () => {
    expect(canSubmitCoupon('BF')).toBe(false);
    expect(canSubmitCoupon('')).toBe(false);
    expect(canSubmitCoupon('BF1')).toBe(true);
  });

  /*
   * Um código de dois caracteres mais um hífen tem três caracteres digitados e
   * dois válidos. O piso vale sobre o que **vai viajar**, e não sobre o que
   * esta na tela — senão o botão habilitaria uma ida ao servidor que volta com
   * "esse cupom não e válido" por um motivo que a tela já sabia.
   */
  it('mede o piso depois de normalizar, e não antes', () => {
    expect(canSubmitCoupon('B-F')).toBe(false);
  });
});

describe('em que pe esta o cupom', () => {
  it('sem código digitado, não ha nada a dizer', () => {
    expect(couponStateOf('', quote(), false)).toEqual({ kind: 'none' });
  });

  it('com o cupom na cotação, esta aplicado', () => {
    const state = couponStateOf('BLACKFRIDAY', quote({ coupon: applied() }), false);

    expect(state.kind).toBe('applied');
  });

  it('com a recusa escrita na cotação, esta recusado — com o motivo do servidor', () => {
    const state = couponStateOf('VENCIDO', quote({ couponWarning: 'Esse cupom venceu.' }), false);

    expect(state).toEqual({ kind: 'refused', code: 'VENCIDO', reason: 'Esse cupom venceu.' });
  });

  /*
   * O caso que justifica o estado `checking` existir.
   *
   * A cotação mantem a resposta anterior na tela enquanto busca a nova. Entre
   * o clique em "Aplicar" e a resposta, a cotação na mão **não sabe** do código
   * novo: ela não tem cupom e não tem recusa. Ler isso como "não valeu" seria
   * negar o desconto antes de perguntar.
   */
  it('enquanto a cotação esta no ar, não anuncia resultado nenhum', () => {
    expect(couponStateOf('BLACKFRIDAY', quote(), true)).toEqual({
      kind: 'checking',
      code: 'BLACKFRIDAY',
    });
  });

  it('com a cotação anterior na mão, também espera em vez de negar', () => {
    expect(couponStateOf('BLACKFRIDAY', quote(), false)).toEqual({
      kind: 'checking',
      code: 'BLACKFRIDAY',
    });
  });

  /*
   * Trocar um código aplicado por outro não pode mostrar o cupom antigo como
   * se fosse o novo: o desconto em tela seria o de um código que já não esta
   * no corpo da cotação.
   */
  it('não dá por aplicado o cupom anterior quando o código mudou', () => {
    const state = couponStateOf('NATAL', quote({ coupon: applied() }), false);

    expect(state).toEqual({ kind: 'checking', code: 'NATAL' });
  });

  it('o botão faz uma coisa de cada vez', () => {
    expect(couponActionLabel({ kind: 'none' })).toBe('Aplicar');
    expect(couponActionLabel({ kind: 'applied', coupon: applied() })).toBe('Tirar');
  });
});

describe('o que o cupom alcançou', () => {
  it('cala quando ele vale para a loja inteira', () => {
    expect(couponReachLabel(applied({ wholeStore: true }), 50_000)).toBe('');
  });

  it('cala quando ele alcançou a sacola toda', () => {
    expect(couponReachLabel(applied({ eligibleSubtotalCents: 50_000 }), 50_000)).toBe('');
  });

  /*
   * A frase que evita a mensagem no WhatsApp: 20% de uma sacola de R$ 500
   * dando R$ 40 parece erro de conta até alguém dizer que só R$ 200 dela
   * estavam na campanha.
   */
  it('escreve o alcance quando ele e menor que a sacola', () => {
    expect(couponReachLabel(applied({ eligibleSubtotalCents: 20_000 }), 50_000)).toBe(
      'Sobre R$ 200,00 em produtos da campanha.',
    );
  });
});

/**
 * O piso e o teto do código são os do servidor.
 *
 * Mesma razão do `wire-contract.spec.ts`: os dois projetos copiam a mão, e o
 * preço da copia aparece inteiro quando ela se desatualiza. Se o backend subir
 * o mínimo para quatro, `canSubmitCoupon` deixaria passar um código de três e
 * a cliente ouviria "esse cupom não e válido" por um motivo de formato que a
 * tela sabia e não disse.
 */
test('o tamanho do código e o mesmo dos dois lados', () => {
  const fonte = readFileSync(
    fileURLToPath(
      new URL('../../../../backend/src/modules/coupons/coupons.constants.ts', import.meta.url),
    ),
    'utf8',
  );

  expect(numeroDoBackend(fonte, 'MIN_COUPON_CODE_LENGTH')).toBe(COUPON_CODE_MIN);
  expect(numeroDoBackend(fonte, 'MAX_COUPON_CODE_LENGTH')).toBe(COUPON_CODE_MAX);
});

function numeroDoBackend(fonte: string, constante: string): number {
  const encontrado = new RegExp(`${constante} = ([0-9]+)`).exec(fonte);

  expect(encontrado, `${constante} não encontrada no fonte do backend`).not.toBeNull();

  return Number(encontrado?.[1]);
}

/* ---- Os corpos de apoio --------------------------------------------------- */

function applied(over: Partial<AppliedCoupon> = {}): AppliedCoupon {
  return {
    couponId: 'c1',
    code: 'BLACKFRIDAY',
    title: 'Black Friday Maison',
    percentOff: 20,
    amountOffCents: null,
    discountLabel: '20% OFF',
    discountCents: 4000,
    eligibleSubtotalCents: 20_000,
    wholeStore: false,
    ...over,
  };
}

/** Só os três campos do cupom importam aqui; o resto da cotação não e lido. */
function quote(over: Partial<CartQuote> = {}): CartQuote {
  return {
    coupon: null,
    couponDiscountCents: 0,
    couponWarning: '',
    ...over,
  } as CartQuote;
}
