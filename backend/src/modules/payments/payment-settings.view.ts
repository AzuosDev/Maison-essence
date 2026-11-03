import { CARD_MODES } from '../../common/enums/card-mode.js';
import type { CardMode } from '../../common/enums/card-mode.js';
import { CARD_PLANS } from '../../common/enums/card-plan.js';
import type { CardPlan } from '../../common/enums/card-plan.js';
import type { PixKeyType } from '../../common/enums/payment-method.js';
import type { InstallmentRules } from './installments.js';
import type { CardRate, PaymentSettingsDocument } from './schemas/payment-settings.schema.js';

/** Uma linha da tabela de taxas, como o painel a lê e a grava. */
export interface CardRateView {
  installments: number;
  linkPercent: number;
  tapPercent: number;
}

/** As regras de pagamento como o painel as vê: tudo, inclusive a chave. */
export interface PaymentSettingsView {
  acceptsPix: boolean;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixDiscountPercent: number;
  acceptsCard: boolean;
  maxInstallments: number;
  interestFreeUpTo: number;
  cardRates: CardRateView[];
  nitroCardRates: CardRateView[];
  activeCardPlan: CardPlan;
  minInstallmentCents: number;
  updatedAt: Date;
}

/**
 * O que a loja aberta sabe sobre o PIX.
 *
 * O tipo da chave sai; a chave, nunca. Não e segredo — ela e feita para ser
 * dada a quem vai pagar — mas só faz sentido no fim do pedido, junto do valor
 * e do nome do titular. Em rota publica cacheada ela seria um dado da loja
 * exposto em toda visita, para quem nunca vai comprar, e indexável.
 *
 * `hasKey` e o que a vitrine precisa: sem chave configurada, o PIX não pode
 * ser oferecido, por mais que a dona tenha deixado a opção ligada.
 */
export interface PublicPixView {
  keyType: PixKeyType;
  hasKey: boolean;
  discountPercent: number;
}

/**
 * O que a loja aberta sabe sobre o cartão.
 *
 * A tabela de taxas **não** esta aqui, e a ausência e deliberada, pelo mesmo
 * motivo da chave PIX. Ela e o custo da loja, item por item — quem a lê sabe
 * exatamente quanto a dona paga a operadora e qual e a margem de cada venda
 * parcelada. Numa rota publica, cacheada na borda, isso ficaria disponível em
 * toda visita, para qualquer um, inclusive para quem vende do outro lado da
 * rua.
 *
 * E ninguém do lado de fora precisa dela. A vitrine anuncia só o parcelamento
 * sem juros, que sai destes três números; as parcelas com taxa quem calcula e
 * a cotação, no servidor, e elas chegam prontas ao checkout.
 */
export interface PublicCardView {
  maxInstallments: number;
  interestFreeUpTo: number;
  minInstallmentCents: number;
}

/**
 * As formas de pagamento da loja aberta.
 *
 * Cada bloco e `null` quando a forma não e aceita, em vez de um campo
 * `acceptsCard: false` ao lado das regras de parcelamento. Desligar o cartão
 * no painel faz a opção *sumir* da resposta: a tela não tem como exibir por
 * engano um parcelamento que a loja não oferece, porque não há o que exibir.
 */
export interface PublicPaymentSettingsView {
  pix: PublicPixView | null;
  card: PublicCardView | null;
}

export function toPaymentSettingsView(settings: PaymentSettingsDocument): PaymentSettingsView {
  return {
    acceptsPix: settings.acceptsPix,
    pixKey: settings.pixKey,
    pixKeyType: settings.pixKeyType,
    pixDiscountPercent: settings.pixDiscountPercent,
    acceptsCard: settings.acceptsCard,
    maxInstallments: settings.maxInstallments,
    interestFreeUpTo: settings.interestFreeUpTo,
    cardRates: settings.cardRates.map(toCardRateView),
    nitroCardRates: settings.nitroCardRates.map(toCardRateView),
    activeCardPlan: settings.activeCardPlan,
    minInstallmentCents: settings.minInstallmentCents,
    updatedAt: settings.updatedAt,
  };
}

export function toPublicPaymentSettingsView(
  settings: PaymentSettingsDocument,
): PublicPaymentSettingsView {
  return {
    pix: settings.acceptsPix
      ? {
          keyType: settings.pixKeyType,
          hasKey: settings.pixKey !== '',
          discountPercent: settings.pixDiscountPercent,
        }
      : null,
    card: settings.acceptsCard
      ? {
          maxInstallments: settings.maxInstallments,
          interestFreeUpTo: settings.interestFreeUpTo,
          minInstallmentCents: settings.minInstallmentCents,
        }
      : null,
  };
}

/**
 * As regras que o cálculo de parcelas consome, na modalidade escolhida.
 *
 * A modalidade entra aqui e não vai adiante: `buildInstallmentOptions` recebe
 * uma tabela de taxas e não sabe de onde ela veio. E o que mantém o cálculo
 * com um caso só — a conta do link e a do tap são a mesma conta com números
 * diferentes, e duplicar o caminho seria criar duas chances de divergir.
 *
 * O plano não e parâmetro: ele e uma decisão da loja, gravada no documento, e
 * quem cota não escolhe. A modalidade e, porque e do cliente.
 */
export function toInstallmentRules(
  settings: PaymentSettingsDocument,
  mode: CardMode,
): InstallmentRules {
  return {
    maxInstallments: settings.maxInstallments,
    interestFreeUpTo: settings.interestFreeUpTo,
    feePercents: feePercentsOf(activeCardRates(settings), mode),
    minInstallmentCents: settings.minInstallmentCents,
  };
}

/**
 * A tabela do plano em uso.
 *
 * Uma função e não um campo porque e aqui que a troca de plano acontece, em
 * um lugar só: ligar o Nitro no painel muda o preço do próximo pedido sem que
 * nada mais no sistema saiba que existem dois planos.
 */
export function activeCardRates(settings: PaymentSettingsDocument): CardRate[] {
  return settings.activeCardPlan === CARD_PLANS.NITRO
    ? settings.nitroCardRates
    : settings.cardRates;
}

/** A coluna da modalidade, indexada pela quantidade de parcelas. */
export function feePercentsOf(
  rates: readonly CardRate[],
  mode: CardMode,
): ReadonlyMap<number, number> {
  return new Map(
    rates.map((rate) => [
      rate.installments,
      mode === CARD_MODES.LINK ? rate.linkPercent : rate.tapPercent,
    ]),
  );
}

function toCardRateView(rate: CardRate): CardRateView {
  return {
    installments: rate.installments,
    linkPercent: rate.linkPercent,
    tapPercent: rate.tapPercent,
  };
}
