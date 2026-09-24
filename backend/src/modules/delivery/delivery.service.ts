import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { FulfillmentMode } from '../../common/enums/fulfillment-mode.js';
import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import { DeliveryCity } from '../../schemas.js';
import { SettingsService } from '../settings/settings.service.js';
import type { Versioned } from '../settings/settings.service.js';
import { toDeliveryCityView, toPublicDeliveryCityView } from './delivery-city.view.js';
import type { DeliveryCityView, PublicDeliveryCityView } from './delivery-city.view.js';
import { resolveDeliveryFee } from './delivery-fee.js';
import type { ResolvedFee } from './delivery-fee.js';
import {
  CITY_NOT_FOUND_MESSAGE,
  CITY_REQUIRED_MESSAGE,
  CITY_TAKEN_MESSAGE,
  CITY_UNAVAILABLE_MESSAGE,
  DUPLICATED_IDS_MESSAGE,
  PICKUP_DISABLED_MESSAGE,
  UNKNOWN_IDS_MESSAGE,
} from './delivery.constants.js';
import type { CreateDeliveryCityDto } from './dto/create-delivery-city.dto.js';
import type { ReorderDeliveryCitiesDto } from './dto/reorder-delivery-cities.dto.js';
import type { UpdateDeliveryCityDto } from './dto/update-delivery-city.dto.js';
import type { DeliveryCityDocument } from './schemas/delivery-city.schema.js';

const DUPLICATE_KEY = 11000;

/** Campos que o PATCH substitui direto, sem regra própria. */
const PLAIN_FIELDS = ['name', 'state', 'feeCents', 'estimatedDays', 'isActive', 'order'] as const;

/** O que o cálculo recebe: modo, cidade e o subtotal de produtos. */
export interface FeeQuery {
  mode: FulfillmentMode;
  /** Ausente ou `null` na retirada, onde não há cidade a escolher. */
  cityId?: string | null;
  /** Subtotal dos produtos, sem a taxa. Em centavos. */
  subtotalCents: number;
}

/**
 * A resposta do cálculo, pronta para virar o snapshot do pedido.
 *
 * Além da taxa, carrega o que o pedido precisa congelar: nome da cidade,
 * estado e prazo. E o que cumpre a promessa de que um pedido antigo continua
 * legível depois de a cidade ser desativada ou reajustada — o pedido não
 * guarda uma referência que amanha responde outra coisa, guarda a copia do
 * que foi combinado.
 */
export interface DeliveryQuote extends ResolvedFee {
  mode: FulfillmentMode;
  cityId: string | null;
  cityName: string;
  state: string;
  estimatedDays: number;
  /** `false` na retirada: quem vem buscar não informa endereço. */
  requiresAddress: boolean;
}

/**
 * Cidades atendidas e a taxa de cada uma.
 *
 * `resolveFee` e a única fonte da taxa no sistema inteiro. O módulo de
 * pedidos pergunta aqui e grava a resposta; ninguém mais multiplica, soma ou
 * compara valor de frete. A razão e a de sempre com dinheiro: duas
 * implementações da mesma regra divergem no dia em que uma delas e corrigida,
 * e a divergência aparece na conta do cliente.
 */
@Injectable()
export class DeliveryService {
  constructor(
    @InjectModel(DeliveryCity.name) private readonly cities: Model<DeliveryCity>,
    private readonly settings: SettingsService,
  ) {}

  /** A lista do painel: ativas e inativas, na ordem escolhida pela dona. */
  async list(): Promise<DeliveryCityView[]> {
    const all = await this.cities.find().sort({ order: 1, name: 1 }).exec();

    return all.map(toDeliveryCityView);
  }

  /**
   * A lista do checkout: só as ativas, ordenadas, com a taxa escrita.
   *
   * Vai junto o `updatedAt` mais recente entre as cidades e as configurações,
   * porque o rótulo de frete grátis de uma cidade sem regra própria depende da
   * regra global da loja: mexer só em `StoreSettings` muda esta resposta, e o
   * ETag precisa mudar com ela.
   */
  async publicList(): Promise<Versioned<PublicDeliveryCityView[]>> {
    const store = await this.settings.current();
    const active = await this.cities.find({ isActive: true }).sort({ order: 1, name: 1 }).exec();

    return {
      payload: active.map((city) => toPublicDeliveryCityView(city, store.freeShippingMinCents)),
      updatedAt: latestChange(active, store.updatedAt),
    };
  }

  async create(dto: CreateDeliveryCityDto): Promise<DeliveryCityView> {
    const created = new this.cities({
      name: dto.name,
      state: dto.state,
      feeCents: dto.feeCents,
      estimatedDays: dto.estimatedDays ?? 1,
      minOrderForFreeCents: dto.minOrderForFreeCents ?? null,
      isActive: dto.isActive ?? true,
      order: dto.order ?? 0,
    });

    return toDeliveryCityView(await this.save(created));
  }

  /**
   * Altera a cidade. Campo ausente fica como esta.
   *
   * `minOrderForFreeCents` distingue ausente de `null`: ausente não mexe na
   * regra, `null` apaga a regra própria e devolve a cidade a regra global.
   */
  async update(id: string, dto: UpdateDeliveryCityDto): Promise<DeliveryCityView> {
    const city = await this.findById(id);

    for (const field of PLAIN_FIELDS) {
      const value = dto[field];

      if (value !== undefined) {
        city.set(field, value);
      }
    }

    if (dto.minOrderForFreeCents !== undefined) {
      city.minOrderForFreeCents = dto.minOrderForFreeCents;
    }

    return toDeliveryCityView(await this.save(city));
  }

  /**
   * Regrava a posição de todas as cidades citadas em uma operação só.
   *
   * `bulkWrite` pelo mesmo motivo do reorder de categorias: arrastar um item
   * remexe a lista inteira, e cada ida ao Atlas custa caro na função
   * serverless.
   */
  async reorder(dto: ReorderDeliveryCitiesDto): Promise<DeliveryCityView[]> {
    if (new Set(dto.ids).size !== dto.ids.length) {
      throw new UnprocessableEntityException(DUPLICATED_IDS_MESSAGE);
    }

    const ids = dto.ids.map((id) => new Types.ObjectId(id));
    const existing = await this.cities.countDocuments({ _id: { $in: ids } }).exec();

    if (existing !== ids.length) {
      throw new UnprocessableEntityException(UNKNOWN_IDS_MESSAGE);
    }

    await this.cities.bulkWrite(
      ids.map((objectId, index) => ({
        updateOne: { filter: { _id: objectId }, update: { $set: { order: index } } },
      })),
    );

    return this.list();
  }

  /**
   * Exclui a cidade.
   *
   * Sem checagem de pedidos, ao contrário da exclusão de categoria: o pedido
   * guarda nome, estado, prazo e taxa em copia própria, e por isso continua
   * legível depois que a cidade some. O que se perde e a possibilidade de
   * voltar a atender ali sem recadastrar — por isso o painel oferece
   * desativar, que e o caminho de quem só quer parar por um tempo.
   */
  async remove(id: string): Promise<void> {
    const city = await this.findById(id);

    await city.deleteOne();
  }

  /**
   * A taxa de entrega de um pedido. Fonte única da verdade.
   *
   * Lê a loja a cada chamada, e não na inicialização: a dona pode ligar a
   * retirada ou mudar o mínimo do frete grátis no painel, e o próximo pedido
   * já sai pela regra nova, sem redeploy.
   */
  async resolveFee(query: FeeQuery): Promise<DeliveryQuote> {
    const store = await this.settings.current();

    if (query.mode === FULFILLMENT_MODES.PICKUP) {
      // Retirada com a loja de portas fechadas para retirada seria um pedido
      // que ninguém combinou: a taxa zera, mas não há onde buscar.
      if (!store.pickupEnabled) {
        throw new UnprocessableEntityException(PICKUP_DISABLED_MESSAGE);
      }

      return {
        ...resolveDeliveryFee({ mode: FULFILLMENT_MODES.PICKUP }),
        mode: FULFILLMENT_MODES.PICKUP,
        cityId: null,
        cityName: '',
        state: '',
        estimatedDays: 0,
        requiresAddress: false,
      };
    }

    const city = await this.deliverableCity(query.cityId ?? null);

    return {
      ...resolveDeliveryFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        city: {
          name: city.name,
          feeCents: city.feeCents,
          minOrderForFreeCents: city.minOrderForFreeCents,
        },
        subtotalCents: query.subtotalCents,
        freeShippingMinCents: store.freeShippingMinCents,
      }),
      mode: FULFILLMENT_MODES.DELIVERY,
      cityId: city._id.toHexString(),
      cityName: city.name,
      state: city.state,
      estimatedDays: city.estimatedDays,
      requiresAddress: true,
    };
  }

  /**
   * A cidade escolhida no checkout, exigindo que ela ainda seja atendida.
   *
   * Cidade desativada responde como cidade que nunca existiu, e com a mesma
   * mensagem: para quem esta comprando, a diferença entre "não atendemos aí" e
   * "paramos de atender aí" não muda nada — o que ele precisa saber e que essa
   * escolha não vale mais e que a retirada continua de pé.
   */
  private async deliverableCity(cityId: string | null): Promise<DeliveryCityDocument> {
    if (cityId === null) {
      throw new UnprocessableEntityException(CITY_REQUIRED_MESSAGE);
    }

    const found = Types.ObjectId.isValid(cityId)
      ? await this.cities.findOne({ _id: new Types.ObjectId(cityId), isActive: true }).exec()
      : null;

    if (!found) {
      throw new UnprocessableEntityException(CITY_UNAVAILABLE_MESSAGE);
    }

    return found;
  }

  /** Busca pelo id, tratando id malformado como "não encontrada". */
  private async findById(id: string): Promise<DeliveryCityDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.cities.findById(new Types.ObjectId(id)).exec()
      : null;

    if (!found) {
      throw new NotFoundException(CITY_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  /** Salva traduzindo a colisão de cidade repetida em 409. */
  private async save(city: DeliveryCityDocument): Promise<DeliveryCityDocument> {
    try {
      return await city.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(CITY_TAKEN_MESSAGE);
      }

      throw error;
    }
  }
}

/** A alteração mais recente entre as cidades e as configurações da loja. */
function latestChange(cities: readonly DeliveryCityDocument[], fallback: Date): Date {
  return cities.reduce(
    (latest, city) => (city.updatedAt > latest ? city.updatedAt : latest),
    fallback,
  );
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
