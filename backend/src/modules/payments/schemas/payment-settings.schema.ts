import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import type { PixKeyType } from '../../../common/enums/payment-method.js';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_VALUES } from '../../../common/enums/payment-method.js';
import { baseSchemaOptions } from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  enumProp,
  integerProp,
  percentProp,
  textProp,
} from '../../../database/schema-helpers.js';
import {
  SingletonSchema,
  applySingletonIndex,
  getOrCreateSingleton,
} from '../../../database/singleton.schema.js';

/** Parcela mínima padrão: R$ 20,00. */
const DEFAULT_MIN_INSTALLMENT_CENTS = 2000;

/**
 * Regras de pagamento. Documento único.
 *
 * Nenhum pagamento e processado aqui: estes campos só descrevem o que a loja
 * aceita e alimentam o cálculo de parcelas que aparece no card e no checkout.
 */
@Schema(baseSchemaOptions({ collection: 'payment_settings' }))
export class PaymentSettings extends SingletonSchema {
  @Prop({ type: Boolean, default: true })
  acceptsPix: boolean;

  /** A rota publica expoe o tipo, nunca a chave inteira. */
  @Prop(textProp({ max: 140, default: '' }))
  pixKey: string;

  @Prop(enumProp(PIX_KEY_TYPE_VALUES, { default: PIX_KEY_TYPES.RANDOM }))
  pixKeyType: PixKeyType;

  /** Desconto do PIX, aplicado só sobre o subtotal de produtos, nunca sobre o frete. */
  @Prop(percentProp({ default: 0, max: 50 }))
  pixDiscountPercent: number;

  @Prop({ type: Boolean, default: true })
  acceptsCard: boolean;

  @Prop(integerProp({ required: true, default: 12, min: 1, max: 24 }))
  maxInstallments: number;

  /** Até esta quantidade de parcelas não há juros; acima dela, tabela price. */
  @Prop(integerProp({ required: true, default: 3, min: 1, max: 24 }))
  interestFreeUpTo: number;

  /**
   * Juros ao mês. E o único percentual fracionário do projeto: 1,99% ao mês e
   * um valor corrente e arredondar para 2% muda o total da última parcela.
   */
  @Prop(percentProp({ default: 0, max: 20, fractional: true }))
  monthlyInterestPercent: number;

  /** Opções de parcelamento que caem abaixo disto são omitidas. */
  @Prop(centsProp({ required: true, default: DEFAULT_MIN_INSTALLMENT_CENTS }))
  minInstallmentCents: number;
}

export type PaymentSettingsDocument = HydratedDocument<PaymentSettings>;

export interface PaymentSettingsModel extends Model<PaymentSettings> {
  /** Devolve as regras de pagamento, criando-as com os padrões na primeira chamada. */
  getOrCreate(): Promise<PaymentSettingsDocument>;
}

export const PaymentSettingsSchema = createSchema(PaymentSettings);

applySingletonIndex(PaymentSettingsSchema);

PaymentSettingsSchema.pre('validate', function () {
  // Parcela sem juros além do máximo de parcelas não significa nada.
  if (this.interestFreeUpTo > this.maxInstallments) {
    this.invalidate(
      'interestFreeUpTo',
      'o limite de parcelas sem juros não pode ser maior que o total de parcelas',
    );
  }
});

PaymentSettingsSchema.statics.getOrCreate = function (
  this: Model<PaymentSettings>,
): Promise<PaymentSettingsDocument> {
  return getOrCreateSingleton(this);
};
