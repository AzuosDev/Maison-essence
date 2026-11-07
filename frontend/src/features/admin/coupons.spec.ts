import { expect, test } from 'vitest';
import type { AdminCoupon } from './admin.types';
import {
  announcedCouponId,
  couponChangesOf,
  couponDraftToCreate,
  couponGroupOf,
  couponScopeLabel,
  couponWindowLabel,
  couponsSummary,
  draftDiscountLabel,
  draftFromCoupon,
  emptyCouponDraft,
  groupCoupons,
  hasCouponErrors,
  maxUsesWarning,
  normalizeCouponCode,
  usesRulerOf,
  usesSentence,
  validateCoupon,
  type CouponDraft,
} from './coupons';

/**
 * As regras do cupom no painel.
 *
 * O que estes casos cobram, em ordem de peso:
 *
 * - **a régua de três números**, que e a razão de a feature existir: as fatias
 *   da barra somam o teto, e nunca 101%;
 * - **a campanha que a home anuncia**, que e uma só e tem de ser a mesma que
 *   o servidor escolhe — divergir aqui e a dona procurando por que a campanha
 *   anunciada não aparece;
 * - **a troca de tipo de desconto**, que manda os dois campos ou e recusada
 *   pelo schema;
 * - **o grupo de cada estado**, com a esgotada em "No ar" de propósito;
 * - **a ida e volta das datas**, que passam por fuso local e voltam.
 */

function coupon(overrides: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: 'c1',
    code: 'BLACKFRIDAY',
    title: 'Black Friday',
    slug: 'black-friday',
    tagline: '',
    percentOff: 20,
    amountOffCents: null,
    discountLabel: '20% OFF',
    maxUses: null,
    usedCount: 0,
    holdingCount: 0,
    remainingUses: null,
    startsAt: null,
    endsAt: null,
    productIds: [],
    wholeStore: true,
    showOnHome: false,
    isActive: true,
    status: 'live',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  };
}

function draft(overrides: Partial<CouponDraft> = {}): CouponDraft {
  return { ...emptyCouponDraft(), code: 'TESTE', title: 'Campanha', percent: '20', ...overrides };
}

/* ---- A régua ------------------------------------------------------------- */

test('a régua reparte o teto entre vendidos, segurados e livres', () => {
  const ruler = usesRulerOf(coupon({ maxUses: 50, usedCount: 20, holdingCount: 7 }));

  expect(ruler).not.toBeNull();
  expect(ruler?.remaining).toBe(23);
  expect(ruler?.usedPercent).toBe(40);
  expect(ruler?.holdingPercent).toBe(14);
});

/**
 * As fatias somam o teto, e nunca o passam.
 *
 * Dois arredondamentos independentes dariam 33% + 33% numa divisão por três e
 * empurrariam a terceira fatia para fora da barra. A segunda sai da soma menos
 * a primeira, que e o que mantem a conta fechada.
 */
test('as fatias nunca passam de cem por cento juntas', () => {
  const ruler = usesRulerOf(coupon({ maxUses: 3, usedCount: 1, holdingCount: 1 }));

  expect(ruler?.usedPercent).toBe(33);
  expect((ruler?.usedPercent ?? 0) + (ruler?.holdingPercent ?? 0)).toBe(67);
  expect(ruler?.remaining).toBe(1);
});

/** Cupom sem teto não tem barra: uma barra que nunca enche promete um fim. */
test('cupom sem teto não desenha régua', () => {
  expect(usesRulerOf(coupon({ maxUses: null, usedCount: 12 }))).toBeNull();
  expect(usesSentence(coupon({ maxUses: null, usedCount: 12 }))).toBe(
    '12 vendidos, sem limite de usos',
  );
});

test('a frase da régua conta os três números, e o singular de cada um', () => {
  expect(
    usesSentence(coupon({ maxUses: 5, usedCount: 1, holdingCount: 1, remainingUses: 3 })),
  ).toBe('1 vendido, 1 em pedido aberto, 3 disponíveis de 5');

  expect(
    usesSentence(coupon({ maxUses: 5, usedCount: 4, holdingCount: 0, remainingUses: 1 })),
  ).toBe('4 vendidos, 1 disponível de 5');
});

/** Esgotado diz "nenhum disponível", e não "0 disponíveis". */
test('a frase da régua esgotada não escreve zero', () => {
  expect(
    usesSentence(coupon({ maxUses: 2, usedCount: 2, holdingCount: 0, remainingUses: 0 })),
  ).toBe('2 vendidos, nenhum disponível de 2');
});

/**
 * O teto estourado pelo servidor não estoura a barra.
 *
 * `usedCount` acima de `maxUses` e possível: a dona baixa o limite depois de
 * vender. A barra para em cheia, e a frase continua verdadeira.
 */
test('vendidos acima do teto param a barra em cheia', () => {
  const ruler = usesRulerOf(coupon({ maxUses: 2, usedCount: 5, holdingCount: 1 }));

  expect(ruler?.usedPercent).toBe(100);
  expect(ruler?.holdingPercent).toBe(0);
  expect(ruler?.remaining).toBe(0);
});

/* ---- A campanha da home -------------------------------------------------- */

/** A que acaba primeiro ganha a vaga, como em `liveForHome` no servidor. */
test('a home anuncia a campanha que acaba primeiro', () => {
  const natal = coupon({
    id: 'natal',
    showOnHome: true,
    endsAt: '2026-12-25T23:59:59.999Z',
  });
  const black = coupon({
    id: 'black',
    showOnHome: true,
    endsAt: '2026-11-30T23:59:59.999Z',
  });

  expect(announcedCouponId([natal, black])).toBe('black');
});

/** Sem prazo vai para o fim do desempate, e não para a frente. */
test('a campanha sem prazo não rouba a vaga da que termina hoje', () => {
  const permanente = coupon({ id: 'parceria', showOnHome: true, endsAt: null });
  const hoje = coupon({ id: 'hoje', showOnHome: true, endsAt: '2026-11-07T23:59:59.999Z' });

  expect(announcedCouponId([permanente, hoje])).toBe('hoje');
});

/** Entre duas sem prazo, vence a mais nova: a novidade e o que se anuncia. */
test('entre duas campanhas sem prazo vence a mais nova', () => {
  const velha = coupon({ id: 'velha', showOnHome: true, createdAt: '2026-01-01T00:00:00.000Z' });
  const nova = coupon({ id: 'nova', showOnHome: true, createdAt: '2026-10-01T00:00:00.000Z' });

  expect(announcedCouponId([velha, nova])).toBe('nova');
});

/**
 * Esgotada e agendada não ocupam a home.
 *
 * A esgotada e o caso que importa: ela esta no ar, e anunciar um código que o
 * fechamento recusa e o pior momento que esta feature produz. O servidor a
 * descarta em `liveCampaign`, e o painel precisa prever a mesma coisa.
 */
test('esgotada, agendada e desligada não ocupam a home', () => {
  const esgotada = coupon({ id: 'esgotada', showOnHome: true, status: 'exhausted' });
  const agendada = coupon({ id: 'agendada', showOnHome: true, status: 'scheduled' });
  const desligada = coupon({ id: 'desligada', showOnHome: true, status: 'paused' });

  expect(announcedCouponId([esgotada, agendada, desligada])).toBeNull();
});

/** Anúncio desligado não entra na disputa, mesmo no ar. */
test('campanha sem anúncio ligado não entra na home', () => {
  expect(announcedCouponId([coupon({ showOnHome: false, status: 'live' })])).toBeNull();
});

/* ---- Os grupos ----------------------------------------------------------- */

test('a esgotada fica em No ar, e a desligada em Encerradas', () => {
  expect(couponGroupOf(coupon({ status: 'live' }))).toBe('live');
  expect(couponGroupOf(coupon({ status: 'exhausted' }))).toBe('live');
  expect(couponGroupOf(coupon({ status: 'scheduled' }))).toBe('scheduled');
  expect(couponGroupOf(coupon({ status: 'ended' }))).toBe('ended');
  expect(couponGroupOf(coupon({ status: 'paused' }))).toBe('ended');
});

test('cada grupo vem na ordem que serve a ele', () => {
  const groups = groupCoupons([
    coupon({ id: 'depois', status: 'live', endsAt: '2026-12-20T00:00:00.000Z' }),
    coupon({ id: 'antes', status: 'live', endsAt: '2026-11-10T00:00:00.000Z' }),
    coupon({ id: 'dezembro', status: 'scheduled', startsAt: '2026-12-01T00:00:00.000Z' }),
    coupon({ id: 'novembro', status: 'scheduled', startsAt: '2026-11-20T00:00:00.000Z' }),
    coupon({ id: 'antiga', status: 'ended', updatedAt: '2026-01-01T00:00:00.000Z' }),
    coupon({ id: 'recente', status: 'paused', updatedAt: '2026-10-01T00:00:00.000Z' }),
  ]);

  expect(groups.live.map((item) => item.id)).toEqual(['antes', 'depois']);
  expect(groups.scheduled.map((item) => item.id)).toEqual(['novembro', 'dezembro']);
  expect(groups.ended.map((item) => item.id)).toEqual(['recente', 'antiga']);
});

/* ---- A validação --------------------------------------------------------- */

test('o código vira caixa alta e perde o que não e letra nem número', () => {
  expect(normalizeCouponCode(' black-friday! ')).toBe('BLACKFRIDAY');
  expect(normalizeCouponCode('natal 2026')).toBe('NATAL2026');
});

test('recusa código curto, nome vazio e percentual fora da faixa', () => {
  expect(validateCoupon(draft({ code: 'AB' })).code).toBeDefined();
  expect(validateCoupon(draft({ title: ' ' })).title).toBeDefined();
  expect(validateCoupon(draft({ percent: '95' })).percent).toBeDefined();
  expect(validateCoupon(draft({ percent: '' })).percent).toBeDefined();
});

test('recusa valor em reais vazio quando o tipo e reais', () => {
  expect(validateCoupon(draft({ kind: 'amount', amount: '' })).amount).toBeDefined();
  expect(hasCouponErrors(validateCoupon(draft({ kind: 'amount', amount: '30,00' })))).toBe(false);
});

/** Teto em branco e aceito: vira `null`, que e "sem limite". */
test('aceita limite em branco e recusa limite zero', () => {
  expect(validateCoupon(draft({ maxUses: '' })).maxUses).toBeUndefined();
  expect(validateCoupon(draft({ maxUses: '0' })).maxUses).toBeDefined();
});

test('recusa a janela que termina antes de começar, e aceita a de um dia', () => {
  expect(
    validateCoupon(draft({ startsOn: '2026-11-30', endsOn: '2026-11-20' })).endsOn,
  ).toBeDefined();

  // Campanha de um dia: o fim e o último instante do mesmo dia, e vale.
  expect(
    validateCoupon(draft({ startsOn: '2026-11-30', endsOn: '2026-11-30' })).endsOn,
  ).toBeUndefined();
});

/* ---- O que vai para o servidor ------------------------------------------- */

test('o rascunho percentual manda o percentual e anula o valor em reais', () => {
  const input = couponDraftToCreate(draft({ code: 'BLACK', percent: '20' }));

  expect(input).toMatchObject({ code: 'BLACK', percentOff: 20, amountOffCents: null });
});

test('o rascunho em reais manda centavos e anula o percentual', () => {
  const input = couponDraftToCreate(draft({ kind: 'amount', amount: '30,00' }));

  expect(input).toMatchObject({ percentOff: null, amountOffCents: 3000 });
});

/**
 * A data sai como o dia inteiro, no fuso de quem cadastrou.
 *
 * "Até 30/11" tem de incluir o dia 30 todo, e o começo e a zero hora local —
 * a mesma conversão dos banners agendados. Sem isso, um cupom cadastrado às
 * 21h de Fortaleza nasceria valendo só a partir do dia seguinte.
 */
test('as datas viajam como começo e fim do dia local', () => {
  const input = couponDraftToCreate(draft({ startsOn: '2026-11-20', endsOn: '2026-11-30' }));

  expect(input.startsAt).toBe(new Date('2026-11-20T00:00:00').toISOString());
  expect(input.endsAt).toBe(new Date('2026-11-30T23:59:59.999').toISOString());
});

/** A volta: o campo mostra o dia local, e não o dia do UTC. */
test('a data salva volta para o campo como o mesmo dia', () => {
  const salvo = coupon({
    startsAt: new Date('2026-11-20T00:00:00').toISOString(),
    endsAt: new Date('2026-11-30T23:59:59.999').toISOString(),
  });

  expect(draftFromCoupon(salvo).startsOn).toBe('2026-11-20');
  expect(draftFromCoupon(salvo).endsOn).toBe('2026-11-30');
});

/* ---- O diff -------------------------------------------------------------- */

test('conferir e sair sem mexer em nada não gasta chamada', () => {
  const salvo = coupon({ maxUses: 50, tagline: 'Os importados que mais saem' });

  expect(couponChangesOf(draftFromCoupon(salvo), salvo)).toBeNull();
});

test('só o campo mudado viaja', () => {
  const salvo = coupon({ maxUses: 50 });
  const changes = couponChangesOf({ ...draftFromCoupon(salvo), maxUses: '80' }, salvo);

  expect(changes).toEqual({ maxUses: 80 });
});

/**
 * A troca de tipo de desconto manda os dois campos.
 *
 * O schema recusa um cupom com percentual e valor preenchidos juntos. Mandar
 * só `amountOffCents` deixaria o `percentOff: 20` no documento, e a gravação
 * seria recusada com uma frase que não explica nada a quem só trocou de opção.
 */
test('trocar de percentual para reais manda os dois campos', () => {
  const salvo = coupon({ percentOff: 20, amountOffCents: null });
  const changes = couponChangesOf(
    { ...draftFromCoupon(salvo), kind: 'amount', amount: '30,00' },
    salvo,
  );

  expect(changes).toEqual({ percentOff: null, amountOffCents: 3000 });
});

/** Lista vazia devolve o cupom a loja inteira, e isso e uma mudança. */
test('tirar todos os produtos viaja como lista vazia', () => {
  const salvo = coupon({ productIds: ['p1', 'p2'], wholeStore: false });
  const changes = couponChangesOf({ ...draftFromCoupon(salvo), productIds: [] }, salvo);

  expect(changes).toEqual({ productIds: [] });
});

/* ---- As frases ----------------------------------------------------------- */

test('o aviso de limite apertado só aparece abaixo do comprometido', () => {
  const salvo = coupon({ maxUses: 50, usedCount: 20, holdingCount: 7 });

  expect(maxUsesWarning({ ...draftFromCoupon(salvo), maxUses: '10' }, salvo)).toContain('27');
  expect(maxUsesWarning({ ...draftFromCoupon(salvo), maxUses: '27' }, salvo)).toBe('');
  expect(maxUsesWarning({ ...draftFromCoupon(salvo), maxUses: '' }, salvo)).toBe('');
  expect(maxUsesWarning(draft({ maxUses: '1' }), null)).toBe('');
});

test('o prazo e escrito pelo último dia que vale', () => {
  const fim = new Date('2026-11-30T23:59:59.999').toISOString();
  const inicio = new Date('2026-11-20T00:00:00').toISOString();

  expect(couponWindowLabel(coupon({ startsAt: null, endsAt: null }))).toBe('Sem prazo');
  expect(couponWindowLabel(coupon({ startsAt: null, endsAt: fim }))).toBe('Até 30/11');
  expect(couponWindowLabel(coupon({ startsAt: inicio, endsAt: null }))).toBe('A partir de 20/11');
  expect(couponWindowLabel(coupon({ startsAt: inicio, endsAt: fim }))).toBe('20/11 a 30/11');
});

test('o recorte diz loja inteira ou quantos produtos', () => {
  expect(couponScopeLabel(coupon({ wholeStore: true }))).toBe('Loja inteira');
  expect(couponScopeLabel(coupon({ wholeStore: false, productIds: ['p1'] }))).toBe('1 produto');
  expect(couponScopeLabel(coupon({ wholeStore: false, productIds: ['p1', 'p2'] }))).toBe(
    '2 produtos',
  );
});

test('o desconto do rascunho aparece só depois de ter número', () => {
  expect(draftDiscountLabel(draft({ percent: '' }))).toBe('');
  expect(draftDiscountLabel(draft({ percent: '20' }))).toBe('20% OFF');
  expect(draftDiscountLabel(draft({ kind: 'amount', amount: '30,00' }))).toBe('R$ 30,00 OFF');
});

/** A esgotada entra na contagem do alto, separada das que estão no ar. */
test('a contagem do alto separa no ar, esgotadas e agendadas', () => {
  expect(couponsSummary(undefined)).toBe('Carregando os cupons');
  expect(couponsSummary([])).toBe('Nenhum cupom cadastrado');

  expect(
    couponsSummary([
      coupon({ id: 'a', status: 'live' }),
      coupon({ id: 'b', status: 'live' }),
      coupon({ id: 'c', status: 'exhausted' }),
      coupon({ id: 'd', status: 'scheduled' }),
    ]),
  ).toBe('2 campanhas no ar, 1 esgotada, 1 agendada');
});
