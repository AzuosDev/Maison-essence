import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  integerProp,
  objectIdProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { MAX_SLUG_LENGTH, applySlugFrom } from '../../../database/slug.js';
import { Product } from '../../products/schemas/product.schema.js';
import {
  COUPON_CODE_PATTERN,
  INVALID_WINDOW_MESSAGE,
  MAX_COUPON_CODE_LENGTH,
  MAX_COUPON_PERCENT,
  MAX_COUPON_TAGLINE_LENGTH,
  MAX_COUPON_TITLE_LENGTH,
  MAX_COUPON_USES,
  MIN_COUPON_PERCENT,
  ONE_DISCOUNT_MESSAGE,
} from '../coupons.constants.js';

/**
 * Cupom de desconto, que e também o período promocional da loja.
 *
 * ## Por que e documento próprio, e não configuração
 *
 * O brinde mora em `StoreSettings` porque e um só: a loja tem uma meta de
 * brinde por vez. Cupons são muitos e simultâneos — a Black Friday no ar, um
 * código silencioso que a dona manda para uma cliente no WhatsApp, a campanha
 * de dezembro já agendada —, e cada um tem validade, teto e contador próprios.
 * Isso pede coleção.
 *
 * E e esse mesmo documento que vira **campanha**: `title`, `tagline` e `slug`
 * existem para a faixa da home e para a página `/promocao/<slug>`. Não há uma
 * segunda entidade "campanha" para a gerente manter em sincronia com o cupom —
 * seria a chance de a home anunciar 20% com um cupom que da 10%.
 *
 * ## O contador e o que o move
 *
 * `usedCount` sobe quando a gerente marca o pedido como **Vendido**, e desce
 * se ela cancelar um pedido já vendido. Nenhum outro caminho mexe nele. Quem
 * grava e `OrdersService`, de um jeito que marcar duas vezes não conta duas
 * (ver `couponConsumedAt` no pedido).
 *
 * Entre o pedido e o "Vendido" existe o "Processando", e esses pedidos já
 * receberam o desconto sem ter entrado no contador. Por isso quem confere o
 * teto não lê `usedCount` sozinho: conta junto os pedidos que estão segurando
 * o cupom. A conta cheia esta em `CouponsService.availabilityOf`.
 */
@Schema(baseSchemaOptions({ collection: 'coupons' }))
export class Coupon extends BaseSchema {
  /**
   * O que a cliente digita. Guardado em maiúsculas, sempre.
   *
   * Normalizar na gravação, e não na leitura, e o que faz `blackfriday` e
   * `BlackFriday` serem o mesmo cupom sem precisar de uma consulta que ignore
   * a caixa — e que, por ignora-lá, não usaria o índice único.
   */
  @Prop(
    textProp({
      required: true,
      max: MAX_COUPON_CODE_LENGTH,
      uppercase: true,
      unique: true,
      match: [
        COUPON_CODE_PATTERN,
        'o código deve ter de 3 a 24 letras e números, sem espaço e sem acento',
      ],
    }),
  )
  code: string;

  /** O nome da campanha: "Black Friday". E o que a faixa da home anuncia. */
  @Prop(textProp({ required: true, max: MAX_COUPON_TITLE_LENGTH }))
  title: string;

  /**
   * O endereço da campanha, gerado do título uma única vez.
   *
   * Uma vez porque o link já circulou: renomear a campanha de "Black Friday"
   * para "Black Friday 2026" não pode quebrar o `/promocao/black-friday` que a
   * dona mandou no story.
   */
  @Prop(textProp({ required: true, max: MAX_SLUG_LENGTH, lowercase: true }))
  slug: string;

  /** A linha que completa a faixa: "só neste fim de semana". Opcional. */
  @Prop(textProp({ max: MAX_COUPON_TAGLINE_LENGTH, default: '' }))
  tagline: string;

  /**
   * Desconto percentual. Exclusivo com `amountOffCents` — ver o `pre('validate')`.
   *
   * O teto de 90% não e capricho: cupom de 100% e um produto de graça, e isso
   * se faz pelo brinde, que tem meta de compra e aparece na mensagem do pedido.
   */
  @Prop(
    integerProp({
      min: MIN_COUPON_PERCENT,
      max: MAX_COUPON_PERCENT,
      default: null,
      message: `o desconto percentual deve ser um inteiro entre ${String(MIN_COUPON_PERCENT)} e ${String(MAX_COUPON_PERCENT)}`,
    }),
  )
  percentOff: number | null;

  /** Desconto em reais, em centavos. Exclusivo com `percentOff`. */
  @Prop(centsProp({ default: null }))
  amountOffCents: number | null;

  /**
   * Quantas vezes o cupom pode ser usado. `null` e "sem teto".
   *
   * `null` e um valor de verdade, e não ausência: o código permanente de uma
   * parceria não tem teto, e exigir um número obrigaria a gerente a inventar
   * um grande o bastante para nunca acabar.
   */
  @Prop(integerProp({ min: 1, max: MAX_COUPON_USES, default: null }))
  maxUses: number | null;

  /** Vendas fechadas com este cupom. Só o "Vendido" do painel mexe aqui. */
  @Prop(integerProp({ required: true, default: 0, max: MAX_COUPON_USES }))
  usedCount: number;

  /**
   * A janela da campanha.
   *
   * Mesma semântica dos banners agendados: início inclusivo, fim exclusivo —
   * "até dia 29" significa que no dia 30, a zero hora, o cupom já não vale. E
   * como a dona pensa ao agendar, e a regra mora em `isCouponLive`.
   */
  @Prop({ type: Date, default: null })
  startsAt: Date | null;

  @Prop({ type: Date, default: null })
  endsAt: Date | null;

  /**
   * Os produtos que o cupom alcança. Lista vazia e "a loja inteira".
   *
   * Nenhum `populate` acontece aqui: o que a cotação precisa são os ids, para
   * comparar com as linhas da sacola. O `ref` fica declarado porque e honesto
   * dizer para onde estes ids apontam, e porque e dele que sai a vitrine da
   * campanha.
   */
  @Prop({ type: [objectIdProp({ ref: Product.name })], default: [] })
  productIds: Types.ObjectId[];

  /**
   * A campanha aparece na home.
   *
   * O interruptor existe porque cupom não e sempre anúncio: o código que a
   * dona manda para uma cliente no WhatsApp funciona no checkout e não pode
   * gritar na vitrine para todo mundo. Desligado, o cupom continua valendo —
   * só não tem faixa, nem fileira, nem página.
   */
  @Prop({ type: Boolean, default: false })
  showOnHome: boolean;

  /** O desligamento manual, independente das datas já escolhidas. */
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type CouponDocument = HydratedDocument<Coupon>;

export const CouponSchema = createSchema(Coupon);

applySlugFrom(CouponSchema, 'title');

/**
 * Um tipo de desconto, e só um; e uma janela que faz sentido.
 *
 * A exclusividade e a mesma regra do `QuantityDiscount`, que aponta para
 * produto ou para categoria e nunca para os dois. Aqui o motivo e o cálculo:
 * com os dois preenchidos, "20% ou R$ 30, o que for maior?" seria uma decisão
 * tomada em silêncio pelo código, e a gerente descobriria qual venceu olhando
 * a conta de um pedido já fechado.
 *
 * A janela invertida e recusada na gravação, e não escondida na exibição: um
 * cupom que termina antes de começar nunca valeria, e o painel mostraria uma
 * campanha salva que ninguém jamais veria.
 */
CouponSchema.pre('validate', function () {
  const kinds = [this.percentOff, this.amountOffCents].filter((value) => value != null);

  if (kinds.length !== 1) {
    this.invalidate('percentOff', ONE_DISCOUNT_MESSAGE);
  }

  if (
    this.startsAt != null &&
    this.endsAt != null &&
    this.endsAt.getTime() <= this.startsAt.getTime()
  ) {
    this.invalidate('endsAt', INVALID_WINDOW_MESSAGE);
  }
});

CouponSchema.index({ slug: 1 }, { unique: true });
/**
 * A campanha da home: as que estão anunciando, a que acaba primeiro na frente.
 *
 * Quem escolhe entre duas campanhas no ar e `liveForHome`, não o índice — no
 * BSON o `null` vem antes de qualquer data, e uma campanha sem prazo roubaria
 * a vaga da que esta acabando hoje.
 */
CouponSchema.index({ showOnHome: 1, isActive: 1, endsAt: 1 });
