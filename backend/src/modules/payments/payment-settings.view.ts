import type { PixKeyType } from '../../common/enums/payment-method.js';
import type { InstallmentRules } from './installments.js';
import type { PaymentSettingsDocument } from './schemas/payment-settings.schema.js';

/** As regras de pagamento como o painel as vê: tudo, inclusive a chave. */
export interface PaymentSettingsView {
  acceptsPix: boolean;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixDiscountPercent: number;
  acceptsCard: boolean;
  maxInstallments: number;
  interestFreeUpTo: number;
  monthlyInterestPercent: number;
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

/** O que a loja aberta sabe sobre o cartão. */
export interface PublicCardView {
  maxInstallments: number;
  interestFreeUpTo: number;
  monthlyInterestPercent: number;
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
    monthlyInterestPercent: settings.monthlyInterestPercent,
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
    card: settings.acceptsCard ? toInstallmentRules(settings) : null,
  };
}

/** As regras que o cálculo de parcelas consome. */
export function toInstallmentRules(settings: PaymentSettingsDocument): InstallmentRules {
  return {
    maxInstallments: settings.maxInstallments,
    interestFreeUpTo: settings.interestFreeUpTo,
    monthlyInterestPercent: settings.monthlyInterestPercent,
    minInstallmentCents: settings.minInstallmentCents,
  };
}
