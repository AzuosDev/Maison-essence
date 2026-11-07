import { formatCents } from '../../common/money.js';
import type { CouponStatus, UseCount } from './coupon.rules.js';
import { couponStatusOf, isWholeStore, remainingUses } from './coupon.rules.js';
import { SCARCITY_THRESHOLD, discountLabel } from './coupons.constants.js';
import type { CouponDocument } from './schemas/coupon.schema.js';

/**
 * O cupom como o painel o vê.
 *
 * Carrega os três números da régua de usos separados — vendidos, segurados e
 * restantes — porque a pergunta da gerente não e "quantos sobraram?", e sim
 * "quantos sobraram **de verdade**?". `usedCount` sozinho esconde os pedidos
 * que já receberam o desconto e ainda não foram marcados como vendidos, e
 * esconder isso e o que faria um cupom de 50 virar 70 sem ninguém notar.
 */
export interface CouponView {
  id: string;
  code: string;
  title: string;
  slug: string;
  tagline: string;
  percentOff: number | null;
  amountOffCents: number | null;
  /** `20% OFF` ou `R$ 30,00 OFF`, escrito uma vez para as duas telas. */
  discountLabel: string;
  maxUses: number | null;
  /** Vendas fechadas com o cupom. */
  usedCount: number;
  /** Pedidos em Processando que já usaram o código. */
  holdingCount: number;
  /** Quantos ainda cabem. `null` quando o cupom não tem teto. */
  remainingUses: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  productIds: string[];
  /** Nenhum produto escolhido: o cupom vale para a loja inteira. */
  wholeStore: boolean;
  showOnHome: boolean;
  isActive: boolean;
  /** Derivado da janela, do interruptor e do teto. Nunca gravado. */
  status: CouponStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A campanha como a loja a anuncia: a faixa da home e a página `/promocao`.
 *
 * O que **não** esta aqui e proposital. `usedCount`, `maxUses` e os pedidos
 * pendentes são a operação da loja, e não dizem nada a quem esta comprando —
 * o que diz e `remainingLabel`, e só quando aperta. `productIds` também fica
 * fora: a vitrine da campanha vem de `GET /products?campanha=<slug>`, que já
 * sabe montar card com preço, parcela e selo.
 */
export interface PublicCampaignView {
  code: string;
  title: string;
  slug: string;
  tagline: string;
  percentOff: number | null;
  amountOffCents: number | null;
  /** `20% OFF`. */
  discountLabel: string;
  /** Quando a campanha sai do ar. `null` e "até segunda ordem". */
  endsAt: Date | null;
  /** O cupom vale para o catálogo inteiro: não há vitrine própria a montar. */
  wholeStore: boolean;
  /**
   * `Restam 7 cupons`, ou vazio.
   *
   * Vazio em três casos: cupom sem teto, teto folgado e cupom esgotado. O
   * último e o que mais importa — anunciar "restam 0" seria a loja gastando a
   * faixa da home para dizer que a cliente chegou tarde.
   */
  scarcityLabel: string;
}

/**
 * O cupom aplicado a uma sacola, como a cotação o devolve.
 *
 * Não e o cupom: e o cupom **nesta sacola**. Os mesmos 20% dao números
 * diferentes em sacolas diferentes, e e esse número — já calculado contra o
 * catálogo de agora — que a tela exibe e que o pedido congela.
 */
export interface AppliedCouponView {
  /**
   * O cupom que a cotação resolveu.
   *
   * Viaja na resposta publica porque e o pedido que precisa dele: a criação
   * refaz a cotação e congela este id no documento, e e por ele que o "Vendido"
   * sabe qual contador mexer. Id opaco não conta nada a quem o recebe — a
   * vitrine inteira já devolve ids de produto e de categoria.
   */
  couponId: string;
  code: string;
  title: string;
  percentOff: number | null;
  amountOffCents: number | null;
  /** `20% OFF`. */
  discountLabel: string;
  /** Quanto este cupom tirou desta sacola, em centavos. */
  discountCents: number;
  /**
   * Quanto do subtotal ele alcançou.
   *
   * Vale a pena na tela quando o cupom e de produtos específicos: a cliente
   * precisa entender por que 20% de uma sacola de R$ 500 deram R$ 40, e a
   * resposta e que só R$ 200 dela estavam na campanha.
   */
  eligibleSubtotalCents: number;
  wholeStore: boolean;
}

export function toCouponView(coupon: CouponDocument, holdingCount: number, now: Date): CouponView {
  const count: UseCount = {
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    holdingCount,
  };

  return {
    id: coupon._id.toHexString(),
    code: coupon.code,
    title: coupon.title,
    slug: coupon.slug,
    tagline: coupon.tagline,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    discountLabel: discountLabel(coupon.percentOff, coupon.amountOffCents),
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    holdingCount,
    remainingUses: remainingUses(count),
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    productIds: coupon.productIds.map((id) => id.toHexString()),
    wholeStore: coupon.productIds.length === 0,
    showOnHome: coupon.showOnHome,
    isActive: coupon.isActive,
    status: couponStatusOf(coupon, count, now),
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

export function toPublicCampaignView(
  coupon: CouponDocument,
  holdingCount: number,
): PublicCampaignView {
  const remaining = remainingUses({
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    holdingCount,
  });

  return {
    code: coupon.code,
    title: coupon.title,
    slug: coupon.slug,
    tagline: coupon.tagline,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    discountLabel: discountLabel(coupon.percentOff, coupon.amountOffCents),
    endsAt: coupon.endsAt,
    wholeStore: coupon.productIds.length === 0,
    scarcityLabel: scarcityLabelOf(remaining),
  };
}

export function toAppliedCouponView(
  coupon: CouponDocument,
  discountCents: number,
  eligibleSubtotalCents: number,
): AppliedCouponView {
  return {
    couponId: coupon._id.toHexString(),
    code: coupon.code,
    title: coupon.title,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    discountLabel: discountLabel(coupon.percentOff, coupon.amountOffCents),
    discountCents,
    eligibleSubtotalCents,
    wholeStore: isWholeStore({
      percentOff: coupon.percentOff,
      amountOffCents: coupon.amountOffCents,
      productIds: coupon.productIds.map((id) => id.toHexString()),
    }),
  };
}

/**
 * A escassez escrita, e só quando ela e verdade e aperta.
 *
 * Nada para cupom sem teto, nada para teto folgado e nada para cupom
 * esgotado. O limite esta em `SCARCITY_THRESHOLD`, e e o que separa "restam 7"
 * — que vende — de "restam 48" — que só conta o tamanho da campanha.
 */
export function scarcityLabelOf(remaining: number | null): string {
  if (remaining === null || remaining <= 0 || remaining > SCARCITY_THRESHOLD) {
    return '';
  }

  return remaining === 1 ? 'Resta 1 cupom' : `Restam ${String(remaining)} cupons`;
}

/** O desconto do cupom como a mensagem do pedido o escreve. */
export function appliedCouponLine(coupon: AppliedCouponView): string {
  return `Cupom ${coupon.code} (${coupon.discountLabel}): -${formatCents(coupon.discountCents)}`;
}
