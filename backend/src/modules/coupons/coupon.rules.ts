/**
 * As regras do cupom, em funções puras.
 *
 * Aqui não entra Mongoose nem HTTP, pelo mesmo motivo de `cart-lines.ts`: o
 * que decide quanto a cliente paga precisa ser testável sem banco, porque os
 * casos que importam são de centavo e de borda — a campanha que terminou
 * ontem, o cupom de R$ 30 numa sacola de R$ 20, as duas campanhas no ar
 * disputando a faixa da home, o teto que estourou por causa de pedidos que
 * ainda não foram marcados como vendidos.
 *
 * Três lugares fazem as mesmas perguntas e precisam das mesmas respostas: a
 * cotação da sacola, a criação do pedido (que refaz a cotação) e a faixa da
 * home. E a lição do brinde (ver `settings/gift.ts`): regra que mora em três
 * telas vira três regras, e quem descobre a divergência e a cliente, depois
 * de comprar.
 */

/** O que basta saber de um cupom para decidir se ele esta valendo agora. */
export interface ScheduledCoupon {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** O cupom reduzido ao que o cálculo usa. Sem ids de documento, sem datas. */
export interface CouponRule {
  percentOff: number | null;
  amountOffCents: number | null;
  /** Vazia e "a loja inteira". */
  productIds: readonly string[];
}

/** Uma linha já cotada, do jeito que o cupom precisa ver. */
export interface DiscountableLine {
  productId: string;
  /** O total da linha, já com o desconto por quantidade aplicado. */
  lineTotalCents: number;
  /** Linha recusada não paga e não desconta. */
  unavailable: boolean;
}

/** O teto de usos de um cupom e o quanto dele já foi comprometido. */
export interface UseCount {
  /** `null` e "sem teto". */
  maxUses: number | null;
  /** Vendas fechadas: o que a gerente marcou como vendido. */
  usedCount: number;
  /** Pedidos que estão segurando o cupom sem ter virado venda ainda. */
  holdingCount: number;
}

/**
 * Se o cupom esta valendo neste instante.
 *
 * Início inclusivo, fim exclusivo, como nos banners agendados: `endsAt` e o
 * instante em que a campanha *sai*, não o último em que ela vale. "Até dia 29"
 * significa que no dia 30, a zero hora, o código deixou de funcionar — e e
 * assim que a dona pensa ao agendar.
 *
 * `isActive` e o desligamento manual, independente das datas: serve para
 * derrubar uma campanha agora sem perder o período que já foi escolhido.
 */
export function isCouponLive(coupon: ScheduledCoupon, now: Date): boolean {
  if (!coupon.isActive) {
    return false;
  }

  const instant = now.getTime();

  if (coupon.startsAt !== null && coupon.startsAt.getTime() > instant) {
    return false;
  }

  return coupon.endsAt === null || coupon.endsAt.getTime() > instant;
}

/**
 * A campanha que a home anuncia: uma só, a que acaba primeiro.
 *
 * Uma porque duas faixas empilhadas no topo são a home pedindo desculpa por
 * não ter escolhido. A que acaba primeiro porque e a única escolha que o
 * cliente sente como urgência verdadeira — anunciar a campanha de dezembro na
 * frente da que termina hoje à noite desperdiça as duas.
 *
 * Campanha sem prazo fica para o fim do desempate, e não na frente: no BSON
 * `null` vem antes de qualquer data, e ordenar pelo banco deixaria o código
 * permanente de parceria tomando a vaga da Black Friday. Entre duas sem prazo,
 * vence a que começou mais tarde — a novidade e o que a vitrine tem a dizer.
 */
export function liveForHome<T extends ScheduledCoupon & { endsAt: Date | null; createdAt: Date }>(
  coupons: readonly T[],
  now: Date,
): T | null {
  const live = coupons.filter((coupon) => isCouponLive(coupon, now));

  return (
    live.toSorted((first, second) => {
      if (first.endsAt === null || second.endsAt === null) {
        if (first.endsAt === second.endsAt) {
          return second.createdAt.getTime() - first.createdAt.getTime();
        }

        return first.endsAt === null ? 1 : -1;
      }

      return first.endsAt.getTime() - second.endsAt.getTime();
    })[0] ?? null
  );
}

/** O cupom vale para a loja inteira? */
export function isWholeStore(rule: CouponRule): boolean {
  return rule.productIds.length === 0;
}

/**
 * Quanto do subtotal este cupom alcança.
 *
 * Sem produtos escolhidos, alcança tudo o que esta disponível na sacola. Com
 * produtos escolhidos, só as linhas deles — foi a decisão tomada no desenho da
 * mecânica: 20% num cupom de três perfumes, numa sacola de seis itens,
 * desconta 20% daqueles três, e o resto paga cheio.
 *
 * Linha recusada não entra, pelo mesmo motivo que ela não entra no subtotal:
 * ela vale zero, e somar zero só criaria a chance de um cupom "valer" para uma
 * sacola em que nenhum item dele esta disponível.
 */
export function eligibleSubtotalOf(
  rule: CouponRule,
  lines: readonly DiscountableLine[],
): number {
  const chosen = new Set(rule.productIds);

  return lines
    .filter((line) => !line.unavailable && (chosen.size === 0 || chosen.has(line.productId)))
    .reduce((total, line) => total + line.lineTotalCents, 0);
}

/**
 * Quanto o cupom tira, em centavos.
 *
 * `Math.round` na virada do centavo, como no desconto do PIX e no desconto por
 * quantidade: 20% de R$ 19,99 são R$ 3,998, e o centavo fica com quem paga.
 *
 * O desconto em reais e limitado ao que ele alcança. Um cupom de R$ 30 numa
 * sacola de R$ 20 elegíveis tira R$ 20, e não R$ 30: desconto maior que a
 * compra viraria total negativo, e crédito a favor do cliente e uma promessa
 * que esta loja não tem como cumprir.
 */
export function couponDiscountOf(rule: CouponRule, eligibleSubtotalCents: number): number {
  if (eligibleSubtotalCents <= 0) {
    return 0;
  }

  if (rule.percentOff !== null) {
    return Math.round((eligibleSubtotalCents * rule.percentOff) / 100);
  }

  return rule.amountOffCents === null
    ? 0
    : Math.min(rule.amountOffCents, eligibleSubtotalCents);
}

/**
 * Quantos usos ainda cabem. `null` quando o cupom não tem teto.
 *
 * Conta o pedido que ainda não virou venda. O contador oficial só sobe no
 * "Vendido" — e o que a dona pediu, e e o número que ela confere —, mas um
 * cupom de três usos com dez pedidos em Processando já prometeu dez descontos.
 * Sem contar o pendente aqui, o teto seria decorativo.
 *
 * Nunca negativo: se dez pedidos entraram num cupom de três por alguma corrida
 * entre duas cotações, o que o resto do sistema precisa saber e que não cabe
 * mais nenhum.
 */
export function remainingUses(count: UseCount): number | null {
  if (count.maxUses === null) {
    return null;
  }

  return Math.max(0, count.maxUses - count.usedCount - count.holdingCount);
}

/** O cupom esgotou: o teto existe e já foi todo comprometido. */
export function isExhausted(count: UseCount): boolean {
  return remainingUses(count) === 0;
}

/**
 * Em que estado o cupom esta, para o painel agrupar.
 *
 * A gerente não precisa ler data para saber o que esta valendo agora, e e
 * disso que sai a separação da tela em **No ar**, **Agendadas** e
 * **Encerradas**. Derivado, nunca gravado: estado guardado em campo precisaria
 * de alguém para virar a chave na meia-noite do dia 30, e esse alguém não
 * existe nesta aplicação.
 *
 * A ordem das perguntas e a ordem da precedência. Desligada vem primeiro
 * porque e a única decisão manual — a dona derrubou a campanha, e dizer
 * "agendada" de algo que ela acabou de desligar seria o painel discutindo com
 * ela. Depois o fim do prazo, que não se desfaz. Depois o começo, que ainda
 * vai chegar. Esgotada por último entre as negativas, porque e a única que
 * pode mudar sozinha: cancelar um pedido vendido devolve o uso e a campanha
 * volta ao ar.
 */
export const COUPON_STATUSES = {
  LIVE: 'live',
  SCHEDULED: 'scheduled',
  ENDED: 'ended',
  EXHAUSTED: 'exhausted',
  PAUSED: 'paused',
} as const;

export type CouponStatus = (typeof COUPON_STATUSES)[keyof typeof COUPON_STATUSES];

export function couponStatusOf(
  coupon: ScheduledCoupon,
  count: UseCount,
  now: Date,
): CouponStatus {
  if (!coupon.isActive) {
    return COUPON_STATUSES.PAUSED;
  }

  const instant = now.getTime();

  if (coupon.endsAt !== null && coupon.endsAt.getTime() <= instant) {
    return COUPON_STATUSES.ENDED;
  }

  if (coupon.startsAt !== null && coupon.startsAt.getTime() > instant) {
    return COUPON_STATUSES.SCHEDULED;
  }

  return isExhausted(count) ? COUPON_STATUSES.EXHAUSTED : COUPON_STATUSES.LIVE;
}
