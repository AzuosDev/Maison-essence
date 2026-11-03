import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import type { CardPlan } from '../../../common/enums/card-plan.js';
import { CARD_PLANS, CARD_PLAN_VALUES } from '../../../common/enums/card-plan.js';
import type { PixKeyType } from '../../../common/enums/payment-method.js';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_VALUES } from '../../../common/enums/payment-method.js';
import { baseSchemaOptions, embeddedSchemaOptions } from '../../../database/base.schema.js';
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
import { MAX_CARD_FEE_PERCENT } from '../payments.constants.js';

/** Parcela mínima padrão: R$ 20,00. */
const DEFAULT_MIN_INSTALLMENT_CENTS = 2000;

/**
 * A taxa da operadora para uma quantidade de parcelas, nas duas modalidades.
 *
 * As duas moram na mesma linha de propósito. A tabela que a dona lê no
 * aplicativo tem uma coluna por modalidade e uma linha por parcela, e e assim
 * que o painel a mostra — guardar duas listas separadas abriria a chance de
 * uma ter doze linhas e a outra dez, e a diferença só apareceria no checkout
 * de quem escolhesse a modalidade incompleta.
 *
 * Os nomes dos campos acompanham `CARD_MODES`: `link` e `tap`.
 */
@Schema(embeddedSchemaOptions({ _id: false }))
export class CardRate {
  /** A quantidade de parcelas a que esta taxa se aplica. 1 e o a vista no cartão. */
  @Prop(integerProp({ required: true, min: 1, max: 24 }))
  installments: number;

  /** Link de pagamento: cartão que a operadora não vê, e a taxa mais cara. */
  @Prop(percentProp({ required: true, max: MAX_CARD_FEE_PERCENT, fractional: true }))
  linkPercent: number;

  /** InfiniteTap na entrega: cartão presente, taxa menor. */
  @Prop(percentProp({ required: true, max: MAX_CARD_FEE_PERCENT, fractional: true }))
  tapPercent: number;
}

export const CardRateSchema = createSchema(CardRate);

/**
 * A tabela com que a loja nasce: as taxas que a operadora publica hoje, nas
 * duas modalidades, para as doze parcelas que ela oferece.
 *
 * ## De onde cada coluna veio
 *
 * O link tem uma tabela só, valendo para Visa, Mastercard, Elo e Amex. O Tap
 * tem duas, e ai esta a decisão: Visa e Mastercard pagam menos (2,69% a vista)
 * do que Elo e Amex (4,46%), e o sistema não sabe qual cartão a cliente vai
 * usar — ela ainda nem escolheu. A coluna guarda a **mais cara**, a de Elo e
 * Amex, pela mesma razão que o Tap não nasce zerado: errar para cima faz a
 * loja receber alguns centavos a mais num cartão Visa, e errar para baixo faz
 * ela pagar a diferença em toda venda no Elo.
 *
 * ## Esta e a tabela do plano padrão
 *
 * O Nitro tem a sua, em `nitroCardRates`, e e `activeCardPlan` que diz qual
 * das duas vale no checkout.
 *
 * ## Isto também e a migração
 *
 * O Mongoose preenche o campo ausente com este padrão na primeira leitura,
 * então a loja que já esta no ar troca os juros ao mês por esta tabela sem
 * script nenhum.
 */
const DEFAULT_CARD_RATES: readonly CardRate[] = [
  { installments: 1, linkPercent: 4.2, tapPercent: 4.46 },
  { installments: 2, linkPercent: 6.09, tapPercent: 5.81 },
  { installments: 3, linkPercent: 7.01, tapPercent: 6.32 },
  { installments: 4, linkPercent: 7.91, tapPercent: 6.83 },
  { installments: 5, linkPercent: 8.8, tapPercent: 7.33 },
  { installments: 6, linkPercent: 9.67, tapPercent: 7.83 },
  { installments: 7, linkPercent: 12.59, tapPercent: 8.34 },
  { installments: 8, linkPercent: 13.42, tapPercent: 8.83 },
  { installments: 9, linkPercent: 14.25, tapPercent: 9.32 },
  { installments: 10, linkPercent: 15.06, tapPercent: 9.81 },
  { installments: 11, linkPercent: 15.87, tapPercent: 10.29 },
  { installments: 12, linkPercent: 16.66, tapPercent: 10.77 },
];

/**
 * A tabela do Nitro, copiada da mesma tela da operadora.
 *
 * ## As duas colunas são iguais aqui, e isso não e engano
 *
 * No plano padrão o link e a maquininha cobram diferente — 12x custa 16,66%
 * num e 10,77% no outro. No Nitro a operadora publica **um preço só**: 12x e
 * 18,79% venha a venda por onde vier. Repetir o mesmo número nas duas colunas
 * e o que a tabela de la diz, e deixar a coluna do Tap mais barata faria a
 * loja receber a menos em toda venda na maquininha.
 *
 * ## Por que ela vem preenchida
 *
 * Uma tabela guardada de um plano que a loja não usa envelhece sem ninguém
 * olhar — e o risco real deste campo. O que decidiu a favor de preencher foi
 * o outro lado: o Nitro se liga e desliga no fim de semana, e exigir doze
 * linhas digitadas do celular no momento da pressa e o jeito mais certo de a
 * dona ligar o plano no aplicativo e esquecer do painel. Vindo preenchida, a
 * conferência e ler, não digitar.
 *
 * Preenchida não significa em uso: `activeCardPlan` continua nascendo em
 * `standard`, e so a troca explicita no painel muda o que o checkout cobra.
 */
const DEFAULT_NITRO_CARD_RATES: readonly CardRate[] = [
  { installments: 1, linkPercent: 5.99, tapPercent: 5.99 },
  { installments: 2, linkPercent: 11.39, tapPercent: 11.39 },
  { installments: 3, linkPercent: 12.49, tapPercent: 12.49 },
  { installments: 4, linkPercent: 13.09, tapPercent: 13.09 },
  { installments: 5, linkPercent: 13.79, tapPercent: 13.79 },
  { installments: 6, linkPercent: 14.49, tapPercent: 14.49 },
  { installments: 7, linkPercent: 15.49, tapPercent: 15.49 },
  { installments: 8, linkPercent: 16.09, tapPercent: 16.09 },
  { installments: 9, linkPercent: 16.69, tapPercent: 16.69 },
  { installments: 10, linkPercent: 17.39, tapPercent: 17.39 },
  { installments: 11, linkPercent: 18.39, tapPercent: 18.39 },
  { installments: 12, linkPercent: 18.79, tapPercent: 18.79 },
];

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

  /**
   * Até esta quantidade de parcelas a loja absorve a taxa da operadora, e o
   * cliente paga o preço de etiqueta. Acima dela, a taxa e repassada.
   *
   * O limite e um só para as duas modalidades, e não um por tabela. Ele e o
   * que a vitrine anuncia — "em até 3x sem juros", no card e na página do
   * produto, antes de qualquer escolha de modalidade existir. Com um limite
   * por modalidade, essa frase teria de prometer o menor dos dois para não
   * mentir, e a dona estaria configurando um número que a loja nunca usa.
   */
  @Prop(integerProp({ required: true, default: 3, min: 1, max: 24 }))
  interestFreeUpTo: number;

  /**
   * A tabela de taxas da operadora, uma linha por quantidade de parcelas.
   *
   * E dado cadastrado, e não conta: a taxa pula de 9,67% em 6x para 12,59% em
   * 7x, e formula nenhuma reproduz esse degrau. A dona copia do aplicativo da
   * maquininha, e refaz quando a operadora reajustar.
   *
   * Linha que falta não e erro: a parcela correspondente simplesmente deixa de
   * ser oferecida acima do limite absorvido. Ver `optionFor` em
   * `installments.ts`.
   */
  @Prop({ type: [CardRateSchema], default: () => [...DEFAULT_CARD_RATES] })
  cardRates: CardRate[];

  /**
   * A mesma tabela, do plano Nitro.
   *
   * Duas listas e não quatro colunas numa linha só, ao contrário do que as
   * duas modalidades fazem. A razão e que a comparação e outra: o link e a
   * maquininha são escolhidos pelo cliente, uma compra de cada vez, e as duas
   * colunas precisam estar completas ao mesmo tempo — uma linha incompleta
   * ofereceria a parcela de um lado e a esconderia do outro. Entre planos só
   * um vale por vez, e o que a loja não usa tem todo o direito de estar
   * vazio — vazio e aceito aqui, mas não vale para o plano **em uso**: a
   * conferencia logo abaixo recusa isso com 422.
   */
  @Prop({ type: [CardRateSchema], default: () => [...DEFAULT_NITRO_CARD_RATES] })
  nitroCardRates: CardRate[];

  /**
   * Qual das duas tabelas vale no checkout.
   *
   * O cliente não vê isto e não precisa: ele vê o preço, que já sai da tabela
   * em uso. Quem liga e desliga e a dona, acompanhando o que ela ligou no
   * aplicativo da operadora — e as duas pontas precisam dizer a mesma coisa,
   * porque vender pela tabela padrão pagando a do Nitro e a diferença saindo
   * do bolso dela em toda venda parcelada.
   */
  @Prop(enumProp(CARD_PLAN_VALUES, { default: CARD_PLANS.STANDARD }))
  activeCardPlan: CardPlan;

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

  // As duas tabelas passam pela mesma conferencia. A do plano que não esta
  // em uso também: ela vai valer um dia, e a hora de descobrir que ha duas
  // linhas de 6x nela não e a hora em que a dona liga o plano.
  checkTable(this, 'cardRates', this.cardRates);
  checkTable(this, 'nitroCardRates', this.nitroCardRates);

  // Ativar um plano sem tabela deixaria a loja oferecendo só as parcelas que
  // ela absorve — sem erro em lugar nenhum, porque taxa que falta esconde a
  // parcela por desenho. E a recusa mais barata do sistema: aqui ela e uma
  // frase, no ar ela e uma semana de vendas pela metade.
  if (this.activeCardPlan === CARD_PLANS.NITRO && this.nitroCardRates.length === 0) {
    this.invalidate(
      'activeCardPlan',
      'a tabela do plano Nitro esta vazia: preencha-a antes de ativar o plano',
    );
  }
});

/**
 * Confere uma tabela de taxas e a ordena.
 *
 * Ordenada por parcela, sempre. A tabela e lida de cima para baixo no painel e
 * linha a linha na trilha de auditoria, e uma linha nova inserida no fim faria
 * as duas leituras pularem.
 */
function checkTable(
  document: HydratedDocument<PaymentSettings>,
  field: 'cardRates' | 'nitroCardRates',
  rates: CardRate[],
): void {
  const seen = new Set<number>();

  for (const rate of rates) {
    if (seen.has(rate.installments)) {
      document.invalidate(field, `ha duas taxas cadastradas para ${String(rate.installments)}x`);
    }

    seen.add(rate.installments);
  }

  rates.sort((a, b) => a.installments - b.installments);
}

PaymentSettingsSchema.statics.getOrCreate = function (
  this: Model<PaymentSettings>,
): Promise<PaymentSettingsDocument> {
  return getOrCreateSingleton(this);
};
