import {
  COUPON_STATUSES,
  couponDiscountOf,
  couponStatusOf,
  eligibleSubtotalOf,
  isCouponLive,
  isExhausted,
  isWholeStore,
  liveForHome,
  remainingUses,
} from './coupon.rules.js';
import type { CouponRule, DiscountableLine, ScheduledCoupon, UseCount } from './coupon.rules.js';

/**
 * As regras do cupom.
 *
 * O que estes casos protegem e a conta que a cliente vê. Três lugares leem
 * daqui — a cotação da sacola, a criação do pedido e a faixa da home —, e
 * divergência entre eles e a loja prometendo numa tela o que recusa na outra.
 *
 * Os valores são os da loja de verdade: perfume de R$ 199,90, cupom de 20%,
 * teto de 50 usos. Caso de borda com número redondo esconde justamente o erro
 * que importa, que e o do centavo.
 */

/** Meio-dia de 20 de novembro. Toda janela destes casos gira em volta dele. */
const AGORA = new Date('2026-11-20T12:00:00.000Z');

function coupon(overrides: Partial<ScheduledCoupon> = {}): ScheduledCoupon {
  return { isActive: true, startsAt: null, endsAt: null, ...overrides };
}

function rule(overrides: Partial<CouponRule> = {}): CouponRule {
  return { percentOff: 20, amountOffCents: null, productIds: [], ...overrides };
}

function line(overrides: Partial<DiscountableLine> = {}): DiscountableLine {
  return { productId: 'asad', lineTotalCents: 19_990, unavailable: false, ...overrides };
}

function count(overrides: Partial<UseCount> = {}): UseCount {
  return { maxUses: 50, usedCount: 0, holdingCount: 0, ...overrides };
}

describe('isCouponLive', () => {
  it('vale com as duas pontas abertas', () => {
    expect(isCouponLive(coupon(), AGORA)).toBe(true);
  });

  /** O desligamento manual derruba a campanha sem apagar as datas dela. */
  it('não vale desligado, mesmo dentro da janela', () => {
    const desligado = coupon({
      isActive: false,
      startsAt: new Date('2026-11-01T00:00:00.000Z'),
      endsAt: new Date('2026-12-01T00:00:00.000Z'),
    });

    expect(isCouponLive(desligado, AGORA)).toBe(false);
  });

  it('não vale antes de começar', () => {
    const agendado = coupon({ startsAt: new Date('2026-11-27T00:00:00.000Z') });

    expect(isCouponLive(agendado, AGORA)).toBe(false);
  });

  /**
   * O início e inclusivo: a campanha que começa agora já esta valendo agora.
   *
   * O contrário faria a dona agendar para as 00:00 e descobrir, as 00:00, que
   * o código ainda não funcionava.
   */
  it('vale no instante exato do início', () => {
    expect(isCouponLive(coupon({ startsAt: AGORA }), AGORA)).toBe(true);
  });

  /**
   * O fim e exclusivo: `endsAt` e o instante em que a campanha *sai*.
   *
   * E a semântica dos banners agendados, e e como a dona pensa ao escrever
   * "até dia 29" — no dia 30, a zero hora, o código já não pega.
   */
  it('não vale no instante exato do fim', () => {
    expect(isCouponLive(coupon({ endsAt: AGORA }), AGORA)).toBe(false);
  });

  it('não vale depois do fim', () => {
    const vencido = coupon({ endsAt: new Date('2026-11-19T23:59:59.000Z') });

    expect(isCouponLive(vencido, AGORA)).toBe(false);
  });
});

describe('liveForHome', () => {
  const comData = (endsAt: string | null, createdAt: string) => ({
    ...coupon({ endsAt: endsAt === null ? null : new Date(endsAt) }),
    endsAt: endsAt === null ? null : new Date(endsAt),
    createdAt: new Date(createdAt),
  });

  it('não anuncia nada quando nenhuma campanha esta no ar', () => {
    expect(liveForHome([], AGORA)).toBeNull();
    expect(
      liveForHome([{ ...comData('2026-11-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z') }], AGORA),
    ).toBeNull();
  });

  /**
   * Entre duas no ar, vence a que acaba primeiro.
   *
   * E a única escolha que o cliente sente como urgência verdadeira: anunciar a
   * campanha de dezembro na frente da que termina hoje à noite desperdica as
   * duas.
   */
  it('escolhe a campanha que acaba primeiro', () => {
    const dezembro = comData('2026-12-25T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    const hojeANoite = comData('2026-11-20T23:00:00.000Z', '2026-10-02T00:00:00.000Z');

    expect(liveForHome([dezembro, hojeANoite], AGORA)).toBe(hojeANoite);
  });

  /**
   * Campanha sem prazo não rouba a vaga da que esta acabando.
   *
   * No BSON o `null` vem antes de qualquer data, e e por isso que a escolha não
   * pode ser do banco: o código permanente de uma parceria tomaria a faixa da
   * home da Black Friday.
   */
  it('deixa a campanha sem prazo para o fim do desempate', () => {
    const permanente = comData(null, '2026-10-01T00:00:00.000Z');
    const blackFriday = comData('2026-11-30T00:00:00.000Z', '2026-11-01T00:00:00.000Z');

    expect(liveForHome([permanente, blackFriday], AGORA)).toBe(blackFriday);
  });

  /** Entre duas sem prazo, a novidade e o que a vitrine tem a dizer. */
  it('entre duas sem prazo, escolhe a mais recente', () => {
    const antiga = comData(null, '2026-01-01T00:00:00.000Z');
    const nova = comData(null, '2026-11-01T00:00:00.000Z');

    expect(liveForHome([antiga, nova], AGORA)).toBe(nova);
  });
});

describe('eligibleSubtotalOf', () => {
  it('alcança a sacola inteira quando o cupom não escolhe produtos', () => {
    const lines = [line(), line({ productId: 'vela', lineTotalCents: 4_500 })];

    expect(eligibleSubtotalOf(rule(), lines)).toBe(24_490);
  });

  /**
   * Com produtos escolhidos, só as linhas deles.
   *
   * E a decisão tomada no desenho da mecânica: 20% num cupom de três perfumes,
   * numa sacola de seis itens, desconta 20% daqueles três — o resto paga cheio.
   */
  it('alcança só os produtos do cupom', () => {
    const lines = [line(), line({ productId: 'vela', lineTotalCents: 4_500 })];

    expect(eligibleSubtotalOf(rule({ productIds: ['asad'] }), lines)).toBe(19_990);
  });

  /**
   * Linha recusada não entra, pelo mesmo motivo que ela não entra no subtotal.
   *
   * Somar zero criaria a chance de um cupom "valer" para uma sacola em que
   * nenhum item dele esta disponível.
   */
  it('ignora a linha indisponível', () => {
    const lines = [line({ unavailable: true }), line({ productId: 'vela', lineTotalCents: 4_500 })];

    expect(eligibleSubtotalOf(rule(), lines)).toBe(4_500);
  });

  it('da zero quando nenhum item e do cupom', () => {
    expect(eligibleSubtotalOf(rule({ productIds: ['outro']}), [line()])).toBe(0);
  });
});

describe('couponDiscountOf', () => {
  /**
   * O centavo fica com quem paga.
   *
   * 20% de R$ 199,90 são R$ 39,98 — e `Math.round` sobe os R$ 39,979 para cá, a
   * favor da cliente. E a mesma regra do desconto do PIX e do desconto por
   * quantidade.
   */
  it('arredonda o percentual a favor de quem paga', () => {
    expect(couponDiscountOf(rule({ percentOff: 20 }), 19_990)).toBe(3_998);
    expect(couponDiscountOf(rule({ percentOff: 10 }), 1_999)).toBe(200);
  });

  it('tira o valor cheio quando o desconto e em reais', () => {
    const emReais = rule({ percentOff: null, amountOffCents: 3_000 });

    expect(couponDiscountOf(emReais, 19_990)).toBe(3_000);
  });

  /**
   * Desconto em reais maior que a compra tira só o que há.
   *
   * Um cupom de R$ 30 numa sacola de R$ 20 elegíveis tira R$ 20: total negativo
   * seria crédito a favor do cliente, e isso esta loja não tem como cumprir.
   */
  it('não tira mais do que a sacola alcançada', () => {
    const emReais = rule({ percentOff: null, amountOffCents: 3_000 });

    expect(couponDiscountOf(emReais, 2_000)).toBe(2_000);
  });

  it('não tira nada de uma sacola sem nada alcançado', () => {
    expect(couponDiscountOf(rule(), 0)).toBe(0);
    expect(couponDiscountOf(rule({ percentOff: null, amountOffCents: 3_000 }), 0)).toBe(0);
  });
});

describe('remainingUses', () => {
  it('não tem resto quando não tem teto', () => {
    expect(remainingUses(count({ maxUses: null, usedCount: 12 }))).toBeNull();
  });

  /**
   * O pendente ocupa vaga.
   *
   * O contador oficial só sobe no "Vendido", mas um cupom de três usos com dez
   * pedidos em Processando já prometeu dez descontos. Sem contar o pendente, o
   * teto seria decorativo.
   */
  it('desconta os vendidos e os que estão segurando', () => {
    expect(remainingUses(count({ maxUses: 50, usedCount: 3, holdingCount: 2 }))).toBe(45);
  });

  it('nunca fica negativo', () => {
    expect(remainingUses(count({ maxUses: 3, usedCount: 3, holdingCount: 7 }))).toBe(0);
  });

  it('esgota quando o teto foi todo comprometido', () => {
    expect(isExhausted(count({ maxUses: 3, usedCount: 1, holdingCount: 2 }))).toBe(true);
    expect(isExhausted(count({ maxUses: 3, usedCount: 1, holdingCount: 1 }))).toBe(false);
    expect(isExhausted(count({ maxUses: null, usedCount: 900 }))).toBe(false);
  });
});

describe('couponStatusOf', () => {
  /** Desligada vence tudo: foi a dona que derrubou a campanha. */
  it('diz desligada antes de qualquer outra coisa', () => {
    const desligadaEVencida = coupon({
      isActive: false,
      endsAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(couponStatusOf(desligadaEVencida, count(), AGORA)).toBe(COUPON_STATUSES.PAUSED);
  });

  it('diz encerrada depois do prazo', () => {
    const vencida = coupon({ endsAt: new Date('2026-11-19T00:00:00.000Z') });

    expect(couponStatusOf(vencida, count(), AGORA)).toBe(COUPON_STATUSES.ENDED);
  });

  it('diz agendada antes do início', () => {
    const agendada = coupon({ startsAt: new Date('2026-11-27T00:00:00.000Z') });

    expect(couponStatusOf(agendada, count(), AGORA)).toBe(COUPON_STATUSES.SCHEDULED);
  });

  /**
   * Esgotada e a última das negativas porque e a única que se desfaz sozinha:
   * cancelar um pedido vendido devolve o uso, e a campanha volta ao ar.
   */
  it('diz esgotada quando não cabe mais nenhum uso', () => {
    expect(couponStatusOf(coupon(), count({ maxUses: 2, usedCount: 2 }), AGORA)).toBe(
      COUPON_STATUSES.EXHAUSTED,
    );
  });

  it('diz no ar quando esta valendo e ainda cabe', () => {
    expect(couponStatusOf(coupon(), count(), AGORA)).toBe(COUPON_STATUSES.LIVE);
  });
});

describe('isWholeStore', () => {
  it('e a loja inteira sem produto escolhido', () => {
    expect(isWholeStore(rule())).toBe(true);
    expect(isWholeStore(rule({ productIds: ['asad'] }))).toBe(false);
  });
});
