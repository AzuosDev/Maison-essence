import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { ORDER_STATUSES } from '../../common/enums/order-status.js';
import { Coupon, Order } from '../../schemas.js';
import {
  couponDiscountOf,
  couponStatusOf,
  eligibleSubtotalOf,
  isCouponLive,
  isExhausted,
  liveForHome,
} from './coupon.rules.js';
import type { CouponStatus, DiscountableLine } from './coupon.rules.js';
import { toAppliedCouponView, toCouponView, toPublicCampaignView } from './coupon.view.js';
import type { AppliedCouponView, CouponView, PublicCampaignView } from './coupon.view.js';
import {
  CAMPAIGN_NOT_FOUND_MESSAGE,
  CODE_TAKEN_MESSAGE,
  COUPON_EXHAUSTED_WARNING,
  COUPON_EXPIRED_WARNING,
  COUPON_NOT_FOR_ITEMS_WARNING,
  COUPON_NOT_FOUND_MESSAGE,
  COUPON_UNKNOWN_WARNING,
} from './coupons.constants.js';
import type { CreateCouponDto } from './dto/create-coupon.dto.js';
import type { UpdateCouponDto } from './dto/update-coupon.dto.js';
import type { CouponDocument } from './schemas/coupon.schema.js';

const DUPLICATE_KEY = 11000;

/** Campos que o PATCH substitui direto, sem regra própria. */
const PLAIN_FIELDS = [
  'code',
  'title',
  'tagline',
  'percentOff',
  'amountOffCents',
  'maxUses',
  'startsAt',
  'endsAt',
  'showOnHome',
  'isActive',
] as const;

/**
 * O cupom resolvido contra uma sacola.
 *
 * `coupon` nulo com `warning` vazio e o caso mais comum de todos: ninguém
 * digitou código nenhum. Nulo **com** frase e o código que não pegou, e aí a
 * sacola continua somando certo e a cliente lê o motivo.
 *
 * Uma frase, e não uma lista: a resolução para na primeira recusa, e nenhum
 * caminho daqui produz dois motivos. O singular e o que deixa a tela pôr a
 * frase embaixo do campo que a causou, que e onde recusa de formulário
 * pertence — ver `couponWarning` em `CartQuoteView`.
 */
export interface ResolvedCoupon {
  coupon: AppliedCouponView | null;
  discountCents: number;
  /** Por que o código não pegou. Vazio quando pegou, e quando não houve código. */
  warning: string;
}

/**
 * Cupons e campanhas.
 *
 * ## Fonte única do desconto
 *
 * `resolve` e o único lugar do sistema que decide se um código vale e quanto
 * ele tira. A cotação da sacola chama; a criação do pedido chama de novo, pelo
 * mesmo caminho, antes de gravar. Nada do que o navegador manda sobre valor e
 * lido — o código diz *qual* cupom, e o banco diz *quanto*. E a mesma regra que
 * vale para preço de produto em `CartQuoteService`.
 *
 * ## O contador, e os pedidos que seguram cupom sem contar
 *
 * `usedCount` sobe no "Vendido" e desce no cancelamento de uma venda. Entre o
 * pedido e o "Vendido" existe o "Processando", e esses pedidos já receberam o
 * desconto — então quem confere o teto soma os dois: o que foi vendido e o que
 * esta segurando.
 *
 * "Segurando" e o pedido que citou o cupom, não foi cancelado e ainda não
 * entrou no contador (`couponConsumedAt` nulo). Cancelar libera a vaga na
 * hora, sem nenhuma rotina de limpeza: a vaga nunca foi um documento, e sempre
 * foi esta contagem.
 */
@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly coupons: Model<Coupon>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  /**
   * A lista do painel: todos os cupons, com a régua de usos de cada um.
   *
   * Uma consulta de cupons e uma de pedidos, agrupada — e não uma contagem por
   * cupom. São poucas campanhas no total, e `N+1` numa função serverless custa
   * o tempo somado de todas as idas ao Atlas.
   */
  async list(): Promise<CouponView[]> {
    const all = await this.coupons.find().sort({ createdAt: -1 }).exec();
    const holds = await this.holdsByCoupon();
    const now = new Date();

    return all.map((coupon) =>
      toCouponView(coupon, holds.get(coupon._id.toHexString()) ?? 0, now),
    );
  }

  async findOne(id: string): Promise<CouponView> {
    const coupon = await this.findById(id);

    return toCouponView(coupon, await this.holdsOf(coupon._id), new Date());
  }

  async create(dto: CreateCouponDto): Promise<CouponView> {
    const created = new this.coupons({
      code: dto.code,
      title: dto.title,
      tagline: dto.tagline ?? '',
      percentOff: dto.percentOff ?? null,
      amountOffCents: dto.amountOffCents ?? null,
      maxUses: dto.maxUses ?? null,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
      productIds: (dto.productIds ?? []).map((id) => new Types.ObjectId(id)),
      showOnHome: dto.showOnHome ?? false,
      isActive: dto.isActive ?? true,
    });

    // Cupom novo nunca tem pedido: a régua de usos nasce zerada, e perguntar
    // ao banco por pedidos de um id que acabou de existir seria uma ida de
    // graca ao Atlas.
    return toCouponView(await this.save(created), 0, new Date());
  }

  /**
   * Altera o cupom. Campo ausente fica como esta.
   *
   * `productIds` distingue ausente de lista vazia: ausente não mexe na
   * campanha, vazia devolve o cupom a loja inteira. E a mesma distinção que
   * `minOrderForFreeCents` faz no cadastro de cidade.
   */
  async update(id: string, dto: UpdateCouponDto): Promise<CouponView> {
    const coupon = await this.findById(id);

    for (const field of PLAIN_FIELDS) {
      const value = dto[field];

      if (value !== undefined) {
        coupon.set(field, value);
      }
    }

    if (dto.productIds !== undefined) {
      coupon.productIds = dto.productIds.map((productId) => new Types.ObjectId(productId));
    }

    const saved = await this.save(coupon);

    return toCouponView(saved, await this.holdsOf(saved._id), new Date());
  }

  /**
   * Exclui o cupom.
   *
   * Sem checagem de pedidos, como na exclusão de cidade de entrega: o pedido
   * guarda código, nome e desconto em copia própria, e continua legível depois
   * que o cupom some. O que se perde e o histórico da campanha e a
   * possibilidade de reativá-la — por isso o painel oferece desligar, que e o
   * caminho de quem só quer encerrar.
   */
  async remove(id: string): Promise<void> {
    const coupon = await this.findById(id);

    await coupon.deleteOne();
  }

  /**
   * A campanha que a home anuncia, ou `null` quando não há nenhuma.
   *
   * Lê só as candidatas — anunciáveis e ligadas —, e escolhe entre elas pela
   * regra pura: a que acaba primeiro. A escolha não e do banco porque `null`
   * em `endsAt` vem antes de qualquer data no BSON, e a campanha permanente
   * roubaria a vaga da que termina hoje à noite.
   *
   * ## A esgotada não sobe
   *
   * Campanha dentro do prazo e ligada, mas sem cupom sobrando, sai da disputa.
   * `liveForHome` sozinho não olha o teto — ele responde "esta valendo?", e
   * uma campanha esgotada **esta** no ar —, e anunciar na home um código que o
   * fechamento vai recusar e o pior momento que esta feature consegue
   * produzir: a cliente digita o que a loja acabou de prometer e ouve que
   * acabou. O painel conta a mesma verdade do outro lado, com a régua cheia e
   * o selo "Esgotada".
   *
   * A contagem de pedidos abertos só e buscada quando alguma candidata tem
   * teto. Campanha sem teto não esgota, e a loja sem campanha nenhuma e o caso
   * mais comum da home — nos dois, esta rota continua com uma consulta só.
   */
  async liveCampaign(): Promise<PublicCampaignView | null> {
    const candidates = await this.coupons
      .find({ showOnHome: true, isActive: true })
      .sort({ endsAt: 1 })
      .exec();

    const holds = candidates.some((coupon) => coupon.maxUses !== null)
      ? await this.holdsByCoupon()
      : new Map<string, number>();

    const available = candidates.filter(
      (coupon) =>
        !isExhausted({
          maxUses: coupon.maxUses,
          usedCount: coupon.usedCount,
          holdingCount: holds.get(coupon._id.toHexString()) ?? 0,
        }),
    );

    const chosen = liveForHome(available, new Date());

    if (chosen === null) {
      return null;
    }

    return toPublicCampaignView(chosen, holds.get(chosen._id.toHexString()) ?? 0);
  }

  /**
   * A campanha de um endereço, para a página `/promocao/<slug>`.
   *
   * 404 quando ela não esta no ar, inclusive para a que terminou ontem: a
   * página de uma campanha encerrada anunciaria um desconto que o checkout vai
   * recusar, e o link dela circula por semanas depois do fim.
   *
   * `showOnHome` **não** entra na condição. O interruptor decide se a campanha
   * ocupa a home, não se ela tem endereço: a dona pode querer uma campanha que
   * só existe no link que ela manda, e esse link precisa abrir.
   */
  async campaignBySlug(slug: string): Promise<PublicCampaignView> {
    const coupon = await this.liveBySlug(slug);

    if (coupon === null) {
      throw new NotFoundException(CAMPAIGN_NOT_FOUND_MESSAGE);
    }

    return toPublicCampaignView(coupon, await this.holdsOf(coupon._id));
  }

  /**
   * Os produtos de uma campanha no ar, para a vitrine filtrar.
   *
   * Lista vazia tem dois significados que a vitrine resolve de formas opostas,
   * e por isso ela recebe `null` num deles: `null` e "campanha que não existe
   * ou não esta no ar", e vazia e "campanha da loja inteira". Devolver vazia
   * para as duas faria o filtro de uma campanha vencida mostrar o catálogo
   * completo como se tudo estivesse em promoção.
   */
  async campaignProductIds(slug: string): Promise<Types.ObjectId[] | null> {
    const coupon = await this.liveBySlug(slug);

    return coupon === null ? null : [...coupon.productIds];
  }

  /**
   * O cupom aplicado a esta sacola: o desconto em centavos e o que avisar.
   *
   * Nenhuma recusa daqui derruba a cotação. Código errado, campanha vencida,
   * cupom esgotado e cupom que não alcança nenhum item da sacola voltam como
   * aviso, e a sacola segue com o total certo — a mesma escolha do item sem
   * estoque em `cart-lines.ts`. Quem esta com seis itens e um código velho
   * merece ver o total dos seis, não um erro que apaga a tela.
   *
   * Código errado, cupom desligado e campanha que ainda não começou dao a
   * mesma frase de propósito. Para quem digitou, a diferença entre "não
   * existe" e "existe mas não vale hoje" não muda nada — e distinguir contaria
   * ao visitante quais códigos a loja tem guardados para dezembro.
   */
  async resolve(
    code: string | undefined,
    lines: readonly DiscountableLine[],
  ): Promise<ResolvedCoupon> {
    const normalized = (code ?? '').trim().toUpperCase();

    if (normalized === '') {
      return EMPTY_RESOLUTION;
    }

    const coupon = await this.coupons.findOne({ code: normalized }).exec();

    if (coupon === null) {
      return refused(COUPON_UNKNOWN_WARNING);
    }

    const now = new Date();

    if (!isCouponLive(coupon, now)) {
      return refused(
        coupon.endsAt !== null && coupon.endsAt.getTime() <= now.getTime()
          ? COUPON_EXPIRED_WARNING
          : COUPON_UNKNOWN_WARNING,
      );
    }

    const holdingCount = await this.holdsOf(coupon._id);

    if (isExhausted({ maxUses: coupon.maxUses, usedCount: coupon.usedCount, holdingCount })) {
      return refused(COUPON_EXHAUSTED_WARNING);
    }

    const rule = {
      percentOff: coupon.percentOff,
      amountOffCents: coupon.amountOffCents,
      productIds: coupon.productIds.map((id) => id.toHexString()),
    };
    const eligibleSubtotalCents = eligibleSubtotalOf(rule, lines);

    if (eligibleSubtotalCents <= 0) {
      /*
       * Cupom da loja inteira sem nada elegível e sacola vazia ou toda
       * recusada, e disso a cotação já falou — ver `EMPTY_QUOTE_WARNING`.
       * Repetir aqui seria a tela culpando o cupom por um carrinho que não
       * tem item nenhum de pé.
       */
      return rule.productIds.length === 0
        ? EMPTY_RESOLUTION
        : refused(COUPON_NOT_FOR_ITEMS_WARNING);
    }

    const discountCents = couponDiscountOf(rule, eligibleSubtotalCents);

    return {
      coupon: toAppliedCouponView(coupon, discountCents, eligibleSubtotalCents),
      discountCents,
      warning: '',
    };
  }

  /**
   * Conta mais um uso: a gerente marcou o pedido como vendido.
   *
   * Pelo documento, e não por `$inc` numa `updateOne`, e a razão e o próprio
   * projeto: `createSchema` liga `runValidators` em toda atualização por query,
   * e o validador de `usedCount` recusaria o `-1` da devolução. Duas mecânicas
   * diferentes para somar e subtrair o mesmo campo seria pior que uma leitura a
   * mais — e quem garante que isto roda uma vez só e o pedido, que reivindica o
   * direito de contar antes de chamar aqui (ver `couponConsumedAt`).
   *
   * Cupom excluído no meio do caminho não e erro: o pedido já esta gravado com
   * o desconto que recebeu, e o contador de uma campanha que não existe mais
   * não tem onde ser escrito.
   */
  async consume(couponId: string): Promise<void> {
    const coupon = await this.byIdOrNull(couponId);

    if (coupon === null) {
      return;
    }

    coupon.usedCount += 1;

    await coupon.save();
  }

  /** Devolve o uso: a venda fechada foi cancelada. Nunca abaixo de zero. */
  async release(couponId: string): Promise<void> {
    const coupon = await this.byIdOrNull(couponId);

    if (coupon === null || coupon.usedCount <= 0) {
      return;
    }

    coupon.usedCount -= 1;

    await coupon.save();
  }

  /** Em que estado um cupom esta agora. Usado pelo painel e pelos testes. */
  async statusOf(id: string): Promise<CouponStatus> {
    const coupon = await this.findById(id);

    return couponStatusOf(
      coupon,
      {
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        holdingCount: await this.holdsOf(coupon._id),
      },
      new Date(),
    );
  }

  /** O cupom deste endereço, só se estiver valendo agora. */
  private async liveBySlug(slug: string): Promise<CouponDocument | null> {
    const coupon = await this.coupons.findOne({ slug: slug.toLowerCase() }).exec();

    return coupon !== null && isCouponLive(coupon, new Date()) ? coupon : null;
  }

  /**
   * Quantos pedidos estão segurando este cupom sem ter entrado no contador.
   *
   * Não cancelado e sem `couponConsumedAt`: e o pedido que recebeu o desconto e
   * ainda não virou venda fechada. Cancelado sai da conta porque a vaga dele
   * voltou para a campanha no instante do cancelamento.
   */
  private holdsOf(couponId: Types.ObjectId): Promise<number> {
    return this.orders
      .countDocuments({
        'coupon.couponId': couponId,
        couponConsumedAt: null,
        status: { $ne: ORDER_STATUSES.CANCELLED },
      })
      .exec();
  }

  /** O mesmo que `holdsOf`, para a lista inteira do painel, em uma consulta. */
  private async holdsByCoupon(): Promise<Map<string, number>> {
    const grouped = await this.orders
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            'coupon.couponId': { $ne: null },
            couponConsumedAt: null,
            status: { $ne: ORDER_STATUSES.CANCELLED },
          },
        },
        { $group: { _id: '$coupon.couponId', count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(grouped.map((row) => [row._id.toHexString(), row.count]));
  }

  /** Busca pelo id, tratando id malformado como "não encontrado". */
  private async findById(id: string): Promise<CouponDocument> {
    const found = await this.byIdOrNull(id);

    if (found === null) {
      throw new NotFoundException(COUPON_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  private async byIdOrNull(id: string): Promise<CouponDocument | null> {
    return Types.ObjectId.isValid(id)
      ? await this.coupons.findById(new Types.ObjectId(id)).exec()
      : null;
  }

  /** Salva traduzindo a colisão de código repetido em 409. */
  private async save(coupon: CouponDocument): Promise<CouponDocument> {
    try {
      return await coupon.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(CODE_TAKEN_MESSAGE);
      }

      throw error;
    }
  }
}

/** Nenhum cupom, nenhum desconto, nada a dizer. */
const EMPTY_RESOLUTION: ResolvedCoupon = { coupon: null, discountCents: 0, warning: '' };

/** O código não pegou, e a cliente precisa saber por que. */
function refused(warning: string): ResolvedCoupon {
  return { coupon: null, discountCents: 0, warning };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
