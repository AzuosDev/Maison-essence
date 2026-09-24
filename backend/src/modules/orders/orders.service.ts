import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import { ORDER_STATUSES } from '../../common/enums/order-status.js';
import type { OrderStatus } from '../../common/enums/order-status.js';
import { PAYMENT_METHODS } from '../../common/enums/payment-method.js';
import type { Paginated } from '../../common/pagination.js';
import { paginate, skipFor } from '../../common/pagination.js';
import { Order } from '../../schemas.js';
import { AUDIT_ACTIONS, AUDIT_TARGETS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CartQuoteService } from '../cart/cart-quote.service.js';
import { CARD_UNAVAILABLE_WARNING, PIX_UNAVAILABLE_WARNING } from '../cart/cart.constants.js';
import type { CartQuoteView } from '../cart/quote.view.js';
import type { AuthenticatedCustomer } from '../customers/customer-auth.types.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { StoreSettingsDocument } from '../settings/schemas/store-settings.schema.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { ListOrdersDto } from './dto/list-orders.dto.js';
import type { UpdateOrderNotesDto } from './dto/update-order-notes.dto.js';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderStockService } from './order-stock.service.js';
import type { StockLine, StockTake } from './order-stock.service.js';
import { toCustomerOrderView, toOrderSummaryView, toOrderView } from './order.view.js';
import type { CreatedOrderView, OrderSummaryView, OrderView } from './order.view.js';
import {
  CANCELLED_IS_FINAL_MESSAGE,
  DEFAULT_PAGE_SIZE,
  INSTALLMENTS_CHANGED_MESSAGE,
  ITEMS_UNAVAILABLE_MESSAGE,
  ORDER_CODE_ATTEMPTS,
  ORDER_NOT_FOUND_MESSAGE,
  ORDER_PHONE_RATE_LIMIT,
  PAYMENT_UNAVAILABLE_MESSAGE,
  QUOTE_MISMATCH_REASONS,
  TOTAL_CHANGED_MESSAGE,
} from './orders.constants.js';
import type { QuoteMismatchReason } from './orders.constants.js';
import { generateOrderCode } from './schemas/order-code.js';
import type { OrderDocument, OrderItem } from './schemas/order.schema.js';
import { buildWhatsappMessage, whatsappUrlOf } from './whatsapp-message.js';
import type { WhatsappAddress } from './whatsapp-message.js';

const DUPLICATE_KEY = 11000;

/** Um dia inteiro em milissegundos, menos o último: o fim de `to`. */
const END_OF_DAY = 24 * 60 * 60 * 1000 - 1;

/**
 * Pedidos: a criação pelo checkout e a gestão pelo painel.
 *
 * O pedido e o único documento do sistema que nasce de fora, sem sessão e sem
 * ninguém conferindo do outro lado. Por isso nada do que chega no corpo vira
 * dinheiro: a cotação e refeita do zero aqui dentro, pelo mesmo serviço que
 * responde `POST /cart/quote`, e o que o cliente mandou de valor serve apenas
 * para uma pergunta — "e isto que você viu na tela?".
 *
 * Se não for, o pedido não e gravado com o número novo em silêncio: volta em
 * 409 com a cotação atual, e quem decide se ainda quer comprar e quem ia
 * pagar.
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    private readonly cart: CartQuoteService,
    private readonly stock: OrderStockService,
    private readonly settings: SettingsService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Fecha o pedido: recotar, conferir, baixar estoque e gravar.
   *
   * A ordem não e arbitrária. O estoque só e baixado depois de a cotação
   * bater, para não reservar unidade de um pedido que vai ser recusado; e a
   * gravação vem depois da baixa, porque um pedido gravado sem estoque
   * reservado e exatamente a venda em duplicidade que se quer evitar. Se a
   * gravação falhar, a baixa e desfeita.
   */
  async create(
    dto: CreateOrderDto,
    customer: AuthenticatedCustomer | null = null,
  ): Promise<CreatedOrderView> {
    // O limite por IP fica no guard da rota; este e o por telefone, que pega o
    // mesmo cliente insistindo de outro lugar — e, principalmente, o
    // formulário reenviado seis vezes numa conexão ruim.
    await this.limits.consume({ ...ORDER_PHONE_RATE_LIMIT, identity: dto.customer.phone });

    const quote = await this.cart.quote(dto);

    assertQuoteHolds(dto, quote);

    const lines = quote.items.map(toStockTake);

    await this.stock.take(lines);

    try {
      return await this.persist(dto, quote, customer);
    } catch (error: unknown) {
      // O pedido não existe: o estoque que ele tirou não pode continuar fora.
      await this.stock.giveBack(lines);

      throw error;
    }
  }

  /**
   * A listagem do painel: status, período e busca.
   *
   * Contagem e página em paralelo, como no catálogo: são duas idas
   * independentes ao banco, e na função serverless o que pesa e o tempo
   * somado.
   */
  async list(query: ListOrdersDto): Promise<Paginated<OrderSummaryView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter = filterFor(query);
    const [found, totalItems] = await Promise.all([
      this.orders
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipFor(page, limit))
        .limit(limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);

    return paginate(found.map(toOrderSummaryView), totalItems, page, limit);
  }

  async findOne(id: string): Promise<OrderView> {
    return toOrderView(await this.findById(id));
  }

  /**
   * Move o pedido de status. Cancelar devolve o estoque.
   *
   * Regravar o mesmo status não faz nada — e o que torna o cancelamento
   * seguro de repetir: a segunda chamada encontra o pedido já cancelado e sai
   * antes de chegar perto do estoque.
   */
  async setStatus(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderView> {
    const order = await this.findById(id);

    if (dto.status === order.status) {
      return toOrderView(order);
    }

    if (order.status === ORDER_STATUSES.CANCELLED) {
      throw new ConflictException(CANCELLED_IS_FINAL_MESSAGE);
    }

    const previous = order.status;
    const view =
      dto.status === ORDER_STATUSES.CANCELLED
        ? await this.cancel(order)
        : toOrderView(await this.moveTo(order, dto.status));

    // Depois da gravação, e nunca antes: trilha de ação que não
    // aconteceu e pior do que trilha nenhuma. O código do pedido vai
    // junto porque e por ele que a dona procura, e não pelo id.
    await this.audit.record({
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      actor: { id: actor.id, email: actor.email, role: actor.role },
      target: {
        kind: AUDIT_TARGETS.ORDER,
        id: order._id.toHexString(),
        label: order.code,
      },
      changes: { status: { from: previous, to: dto.status } },
    });

    return view;
  }

  /** A virada simples de status, que e tudo o que não e cancelamento. */
  private moveTo(order: OrderDocument, status: OrderStatus): Promise<OrderDocument> {
    order.status = status;

    return order.save();
  }

  /** A anotação interna. Substitui a anterior; vazio apaga. */
  async setNotes(id: string, dto: UpdateOrderNotesDto): Promise<OrderView> {
    const order = await this.findById(id);

    order.notes = dto.notes;

    return toOrderView(await order.save());
  }

  /**
   * Cancela e devolve o estoque, uma vez só.
   *
   * A virada do status e a própria reserva do direito de devolver: quem
   * conseguir gravar `CANCELLED` partindo de qualquer outro status e quem
   * devolve, e duas chamadas simultaneas não podem as duas conseguir. E o que
   * cumpre "cancelar duas vezes não devolve duas vezes" sem depender de
   * ninguém ter lido o pedido antes.
   *
   * Falhando a devolução depois da virada, o pedido fica cancelado e o
   * estoque, baixado — e o lado seguro do erro: sobra conferência manual, e
   * não unidade inventada que a loja não tem na prateleira.
   */
  private async cancel(order: OrderDocument): Promise<OrderView> {
    const claimed = await this.orders
      .findOneAndUpdate(
        { _id: order._id, status: { $ne: ORDER_STATUSES.CANCELLED } },
        { $set: { status: ORDER_STATUSES.CANCELLED, stockRestoredAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    if (claimed === null) {
      // Outra chamada cancelou primeiro e já devolveu o estoque.
      return toOrderView(await this.findById(order._id.toHexString()));
    }

    await this.stock.giveBack(claimed.items.map(toStockLine));

    return toOrderView(claimed);
  }

  /**
   * Grava o pedido, sorteando outro código se o primeiro colidir.
   *
   * A colisão e improvável — 1,6 milhão de combinações por dia — mas o índice
   * único em `code` existe justamente para que ela não passe despercebida, e
   * responder 500 a um cliente por causa de um sorteio seria desperdicar a
   * venda. A mensagem e montada dentro do laço porque carrega o código.
   */
  private async persist(
    dto: CreateOrderDto,
    quote: CartQuoteView,
    customer: AuthenticatedCustomer | null,
  ): Promise<CreatedOrderView> {
    const store = await this.settings.current();

    for (let attempt = 1; ; attempt += 1) {
      const order = new this.orders({
        ...snapshotOf(dto, quote, customer),
        code: generateOrderCode(),
      });

      order.whatsappMessage = this.messageFor(order.code, dto, quote, store);

      try {
        await order.save();

        return {
          orderId: order._id.toHexString(),
          code: order.code,
          whatsappUrl: whatsappUrlOf(store.whatsappNumber, order.whatsappMessage),
          order: toCustomerOrderView(order),
        };
      } catch (error: unknown) {
        if (!isDuplicateKey(error) || attempt >= ORDER_CODE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  /** A mensagem do WhatsApp deste pedido, com o que a loja configurou. */
  private messageFor(
    code: string,
    dto: CreateOrderDto,
    quote: CartQuoteView,
    store: StoreSettingsDocument,
  ): string {
    const selected = quote.payment.selected;

    return buildWhatsappMessage({
      code,
      items: quote.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountPercent: item.discountPercent,
        discountCents: item.discountCents,
        lineTotalCents: item.lineTotalCents,
      })),
      customer: { name: dto.customer.name, phone: dto.customer.phone },
      fulfillment: {
        mode: quote.fulfillment.mode,
        cityName: quote.fulfillment.cityName,
        state: quote.fulfillment.state,
        estimatedDays: quote.fulfillment.estimatedDays,
        feeCents: quote.deliveryFeeCents,
        freeReason: quote.fulfillment.freeReason,
        address: addressOf(dto, quote),
        pickupInstructions: store.pickupInstructions,
      },
      payment: {
        method: quote.payment.method,
        installments: quote.payment.installments,
        installmentCents: selected?.installmentCents ?? 0,
        firstInstallmentCents: selected?.firstInstallmentCents ?? 0,
        hasInterest: selected?.hasInterest ?? false,
        financedTotalCents: selected?.totalCents ?? quote.totalCents,
      },
      totals: {
        subtotalCents: quote.subtotalCents,
        discountTotalCents: quote.discountTotalCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        pixDiscountCents: quote.pixDiscountCents,
        totalCents: quote.totalCents,
      },
    });
  }

  /** Busca pelo id, tratando id malformado como "não encontrado". */
  private async findById(id: string): Promise<OrderDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.orders.findById(new Types.ObjectId(id)).exec()
      : null;

    if (!found) {
      throw new NotFoundException(ORDER_NOT_FOUND_MESSAGE);
    }

    return found;
  }
}

/**
 * Confere se a cotação refeita ainda e a que o cliente viu.
 *
 * Três perguntas, três respostas diferentes. Forma de pagamento que a loja
 * parou de aceitar e 422: não e divergência de valor, e um pedido que não pode
 * existir do jeito que foi montado. Item indisponível e total diferente são
 * 409 com a cotação nova no `details`, porque há o que mostrar e há o que
 * decidir — e a decisão e de quem paga.
 */
function assertQuoteHolds(dto: CreateOrderDto, quote: CartQuoteView): void {
  const blocked = quote.warnings.find(
    (warning) => warning === PIX_UNAVAILABLE_WARNING || warning === CARD_UNAVAILABLE_WARNING,
  );

  if (blocked !== undefined) {
    throw new UnprocessableEntityException({
      message: PAYMENT_UNAVAILABLE_MESSAGE,
      details: { warning: blocked, quote },
    });
  }

  if (quote.items.some((item) => item.unavailable)) {
    throw mismatch(ITEMS_UNAVAILABLE_MESSAGE, QUOTE_MISMATCH_REASONS.ITEMS, quote);
  }

  if (quote.totalCents !== dto.expectedTotalCents) {
    throw mismatch(TOTAL_CHANGED_MESSAGE, QUOTE_MISMATCH_REASONS.TOTAL, quote);
  }

  // Só no cartão: no PIX o parcelamento pedido não muda valor nenhum, e a
  // cotação já avisa que o pagamento e a vista.
  if (
    quote.payment.method === PAYMENT_METHODS.CARD &&
    (dto.payment.installments ?? 1) !== quote.payment.installments
  ) {
    throw mismatch(INSTALLMENTS_CHANGED_MESSAGE, QUOTE_MISMATCH_REASONS.INSTALLMENTS, quote);
  }
}

/** O 409 que o checkout entende: o motivo e a cotação inteira, recalculada. */
function mismatch(
  message: string,
  reason: QuoteMismatchReason,
  quote: CartQuoteView,
): ConflictException {
  return new ConflictException({ message, details: { reason, quote } });
}

/** O pedido pronto para gravar, todo ele saido da cotação do servidor. */
function snapshotOf(
  dto: CreateOrderDto,
  quote: CartQuoteView,
  customer: AuthenticatedCustomer | null,
): Record<string, unknown> {
  return {
    items: quote.items.map((item) => ({
      productId: new Types.ObjectId(item.productId),
      variantId: new Types.ObjectId(item.variantId),
      productName: item.productName,
      variantLabel: item.variantLabel,
      image: item.image,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      lineTotalCents: item.lineTotalCents,
    })),
    customer: {
      name: dto.customer.name,
      phone: dto.customer.phone,
      email: dto.customer.email ?? '',
    },
    fulfillment: {
      mode: quote.fulfillment.mode,
      cityId:
        quote.fulfillment.cityId === null ? null : new Types.ObjectId(quote.fulfillment.cityId),
      cityName: quote.fulfillment.cityName,
      state: quote.fulfillment.state,
      estimatedDays: quote.fulfillment.estimatedDays,
      address: addressOf(dto, quote),
    },
    payment: {
      method: quote.payment.method,
      installments: quote.payment.installments,
      hasInterest: quote.payment.selected?.hasInterest ?? false,
    },
    totals: {
      subtotalCents: quote.subtotalCents,
      discountTotalCents: quote.discountTotalCents,
      deliveryFeeCents: quote.deliveryFeeCents,
      pixDiscountCents: quote.pixDiscountCents,
      totalCents: quote.totalCents,
    },
    status: ORDER_STATUSES.PENDING_CONTACT,
    /**
     * A conta de quem comprou, quando havia uma sessão.
     *
     * `null` no checkout como convidado, que e o caminho padrão — e não fica
     * `null` para sempre: se essa pessoa criar uma conta depois com o mesmo
     * telefone, e o cadastro que vem buscar este pedido (ver
     * `CustomerAuthService.adoptGuestOrders`).
     *
     * Os dados de contato continuam vindo do formulário, mesmo com o cliente
     * logado: quem compra para a irma preenche o nome e o telefone da irma, e
     * sobrescrever isso com os da conta mandaria a dona conversar com a pessoa
     * errada.
     */
    customerId: customer === null ? null : new Types.ObjectId(customer.id),
  };
}

/**
 * O endereço do pedido, ou `null` na retirada.
 *
 * Quem decide e o modo que o `DeliveryService` confirmou, não o que veio no
 * corpo: um endereço gravado num pedido de retirada viraria uma entrega que
 * ninguém combinou na leitura do painel.
 */
function addressOf(dto: CreateOrderDto, quote: CartQuoteView): WhatsappAddress | null {
  if (quote.fulfillment.mode !== FULFILLMENT_MODES.DELIVERY || dto.address === undefined) {
    return null;
  }

  return {
    street: dto.address.street,
    number: dto.address.number ?? '',
    complement: dto.address.complement ?? '',
    district: dto.address.district,
    zipCode: dto.address.zipCode ?? '',
    reference: dto.address.reference ?? '',
  };
}

/** A linha da cotação como a baixa de estoque a quer. */
function toStockTake(item: {
  productId: string;
  variantId: string;
  quantity: number;
  allowBackorder: boolean;
}): StockTake {
  return {
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    allowBackorder: item.allowBackorder,
  };
}

/** O item gravado como a devolução a quer. */
function toStockLine(item: OrderItem): StockLine {
  return {
    productId: item.productId.toHexString(),
    variantId: item.variantId.toHexString(),
    quantity: item.quantity,
  };
}

/** O filtro da listagem, montado só com o que a dona preencheu. */
function filterFor(query: ListOrdersDto): QueryFilter<Order> {
  const filter: QueryFilter<Order> = {};

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  const createdAt = {
    ...(query.from === undefined ? {} : { $gte: query.from }),
    ...(query.to === undefined ? {} : { $lte: endOfDay(query.to) }),
  };

  if (Object.keys(createdAt).length > 0) {
    filter.createdAt = createdAt;
  }

  const term = query.q ?? '';

  return term === '' ? filter : { ...filter, ...searchFor(term) };
}

/**
 * Código ou telefone, decidido pelo que foi digitado.
 *
 * Texto com letra e busca de código, começando pelo início — `ME-2509` traz o
 * dia inteiro, que e como a dona procura quando só lembra a data. Só digitos e
 * busca de telefone, e sem ancora: o que ela tem na tela do celular são os
 * últimos quatro números de quem esta ligando.
 */
function searchFor(term: string): QueryFilter<Order> {
  const digits = term.replace(/\D/g, '');

  if (digits.length >= 4 && /^[\d\s()+-]+$/.test(term)) {
    return { 'customer.phone': new RegExp(escapeRegex(digits)) };
  }

  return { code: new RegExp(`^${escapeRegex(term)}`, 'i') };
}

/**
 * O fim do dia de `to`, quando ele veio sem hora.
 *
 * `to=2026-09-21` significa "até o dia 21" para quem digitou, e significaria
 * "até a meia-noite do dia 21" para o banco — o filtro deixaria de fora os
 * pedidos do dia inteiro que a dona queria ver, incluindo o que ela esta
 * procurando.
 */
function endOfDay(to: Date): Date {
  return to.getUTCHours() === 0 && to.getUTCMinutes() === 0 && to.getUTCSeconds() === 0
    ? new Date(to.getTime() + END_OF_DAY)
    : to;
}

/** O termo digitado não pode virar metacaractere de regex. */
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
