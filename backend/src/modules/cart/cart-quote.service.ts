import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { PAYMENT_METHODS } from '../../common/enums/payment-method.js';
import { Product, QuantityDiscount } from '../../schemas.js';
import { DeliveryService } from '../delivery/delivery.service.js';
import { InstallmentService } from '../payments/installment.service.js';
import type { InstallmentOption } from '../payments/installments.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { LeanProduct } from '../products/public-product.view.js';
import type { QuantityDiscountRule } from '../products/quantity-discount.js';
import { itemWarnings, mergeLines, quoteItems, sumItems } from './cart-lines.js';
import type { CatalogProduct, QuoteItem, RequestedLine } from './cart-lines.js';
import {
  CARD_UNAVAILABLE_WARNING,
  EMPTY_QUOTE_WARNING,
  PIX_HAS_NO_INSTALLMENTS_WARNING,
  PIX_UNAVAILABLE_WARNING,
  installmentsUnavailableWarning,
} from './cart.constants.js';
import type { QuoteCartDto } from './dto/quote-cart.dto.js';
import type { CartQuoteView, QuotePaymentView } from './quote.view.js';

/** O card nao mostra a descricao, e ela e o maior campo do produto. */
const QUOTE_FIELDS = '-description';

/** O que o pagamento resolve: o total, o desconto do PIX e as parcelas. */
interface SettledPayment {
  payment: QuotePaymentView;
  pixDiscountCents: number;
  totalCents: number;
  installmentOptions: InstallmentOption[];
}

/**
 * A cotacao do carrinho, refeita do zero a cada chamada.
 *
 * E a resposta a pergunta "quanto da isto?", e e a unica resposta que vale:
 * o que o navegador mostrou pode estar velho por minutos ou por dias — carrinho
 * guardado no `localStorage` sobrevive a reajuste de preco, a produto
 * desativado e a estoque que acabou. Por isso nada do que o cliente manda
 * sobre valores e lido: os ids dizem *o que* ele quer, e o banco diz *quanto
 * custa*.
 *
 * Nada e gravado aqui. A rota nao cria carrinho, nao reserva estoque e nao
 * deixa rastro do que foi simulado — quem persiste e a criacao do pedido, que
 * refaz esta mesma conta antes de gravar.
 */
@Injectable()
export class CartQuoteService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(QuantityDiscount.name) private readonly discounts: Model<QuantityDiscount>,
    private readonly delivery: DeliveryService,
    private readonly payments: PaymentsService,
    private readonly installments: InstallmentService,
  ) {}

  /**
   * Recalcula a sacola inteira: itens, entrega e pagamento.
   *
   * Item invalido nao derruba a cotacao. Ele volta marcado, com o motivo, e
   * vale zero — quem esta com seis itens na sacola e um deles esgotou merece
   * ver o total dos outros cinco, nao um erro que apaga a tela inteira.
   *
   * O que derruba e a escolha de entrega: cidade que a loja nao atende mais
   * ou retirada desligada vem do `DeliveryService` como 422, porque ai nao ha
   * cotacao parcial possivel — nao da para somar uma taxa que nao existe.
   */
  async quote(dto: QuoteCartDto): Promise<CartQuoteView> {
    const { lines, warnings } = mergeLines(dto.items);
    const catalog = await this.load(lines);
    const items = quoteItems(lines, catalog, await this.rulesFor(catalog));
    const { subtotalCents, discountTotalCents } = sumItems(items);
    const fulfillment = await this.delivery.resolveFee({
      mode: dto.fulfillment.mode,
      cityId: dto.fulfillment.cityId ?? null,
      subtotalCents,
    });
    const settled = await this.settle(dto.payment, subtotalCents, fulfillment.feeCents);

    return {
      items,
      fulfillment,
      payment: settled.payment,
      subtotalCents,
      discountTotalCents,
      deliveryFeeCents: fulfillment.feeCents,
      pixDiscountCents: settled.pixDiscountCents,
      totalCents: settled.totalCents,
      installmentOptions: settled.installmentOptions,
      warnings: [
        ...warnings,
        ...itemWarnings(items),
        ...emptyWarning(items),
        ...(await this.paymentWarnings(dto.payment, settled)),
      ],
    };
  }

  /**
   * Os produtos citados na sacola, inclusive os desativados.
   *
   * Filtrar por `isActive` na consulta pareceria natural e seria pior: o
   * produto que saiu do catalogo voltaria como "produto nao encontrado", sem
   * nome, e a sacola exibiria uma linha anonima. Buscando todos, a linha
   * recusada ainda sabe dizer de qual produto se trata.
   */
  private async load(lines: readonly RequestedLine[]): Promise<CatalogProduct[]> {
    const ids = [...new Set(lines.map((line) => line.productId))]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (ids.length === 0) {
      return [];
    }

    const found = await this.products
      .find({ _id: { $in: ids } })
      .select(QUOTE_FIELDS)
      .lean<LeanProduct[]>()
      .exec();

    return found.map(toCatalogProduct);
  }

  /**
   * As regras de desconto por quantidade que podem valer para esta sacola.
   *
   * Uma consulta so para o carrinho inteiro, como na vitrine: sao poucas
   * regras no total, e decidir qual vale para cada produto e conta de
   * memoria.
   */
  private async rulesFor(products: readonly CatalogProduct[]): Promise<QuantityDiscountRule[]> {
    if (products.length === 0) {
      return [];
    }

    const found = await this.discounts
      .find({
        isActive: true,
        $or: [
          { productId: { $in: products.map((product) => new Types.ObjectId(product.id)) } },
          {
            categoryId: {
              $in: products.flatMap((product) =>
                product.categoryIds.map((id) => new Types.ObjectId(id)),
              ),
            },
          },
        ],
      })
      .lean<QuantityDiscount[]>()
      .exec();

    return found.map((rule) => ({
      productId: rule.productId?.toHexString() ?? null,
      categoryId: rule.categoryId?.toHexString() ?? null,
      minQty: rule.minQty,
      percentOff: rule.percentOff,
    }));
  }

  /**
   * Fecha a conta pela forma de pagamento escolhida.
   *
   * O PIX e o cartao nao sao o mesmo total com etiquetas diferentes: o PIX
   * desconta um percentual do subtotal e nao se parcela; o cartao paga o
   * valor cheio e se divide. Trocar a forma muda o numero, e e por isso que a
   * escolha entra na cotacao em vez de ser decidida so na hora de fechar.
   */
  private async settle(
    chosen: QuoteCartDto['payment'],
    subtotalCents: number,
    deliveryFeeCents: number,
  ): Promise<SettledPayment> {
    if (chosen.method === PAYMENT_METHODS.PIX) {
      const pix = await this.payments.pixQuote(subtotalCents, deliveryFeeCents);

      return {
        // Uma parcela, sempre: no PIX o pagamento e unico, e oferecer uma
        // lista vazia e mais honesto do que repetir as opcoes do cartao com
        // um total que nao vale para elas.
        payment: { method: chosen.method, installments: 1, selected: null },
        pixDiscountCents: pix.discountCents,
        totalCents: pix.totalCents,
        installmentOptions: [],
      };
    }

    const totalCents = subtotalCents + deliveryFeeCents;
    const installmentOptions = await this.installments.buildOptions(totalCents);
    const requested = chosen.installments ?? 1;
    // O parcelamento que vale e o que existe na lista calculada agora. Quando
    // o pedido nao esta la — 12x num total que nao alcanca a parcela minima —,
    // vale a vista, que e a unica opcao sempre oferecida.
    const selected =
      installmentOptions.find((option) => option.number === requested) ??
      installmentOptions[0] ??
      null;

    return {
      payment: { method: chosen.method, installments: selected?.number ?? 1, selected },
      pixDiscountCents: 0,
      totalCents,
      installmentOptions,
    };
  }

  /** O que dizer sobre a forma de pagamento escolhida, sem recusar a cotacao. */
  private async paymentWarnings(
    chosen: QuoteCartDto['payment'],
    settled: SettledPayment,
  ): Promise<string[]> {
    const requested = chosen.installments ?? 1;

    if (chosen.method === PAYMENT_METHODS.PIX) {
      const settings = await this.payments.current();

      return [
        ...(settings.acceptsPix ? [] : [PIX_UNAVAILABLE_WARNING]),
        ...(requested > 1 ? [PIX_HAS_NO_INSTALLMENTS_WARNING] : []),
      ];
    }

    // Lista vazia no cartao so acontece de um jeito: a loja nao o aceita. A
    // opcao a vista nunca e filtrada pela parcela minima.
    if (settled.installmentOptions.length === 0) {
      return [CARD_UNAVAILABLE_WARNING];
    }

    return settled.payment.installments === requested
      ? []
      : [installmentsUnavailableWarning(requested, settled.totalCents)];
  }
}

/** O produto do banco traduzido para o que o calculo entende. */
function toCatalogProduct(product: LeanProduct): CatalogProduct {
  return {
    id: product._id.toHexString(),
    name: product.name,
    slug: product.slug,
    coverImage: product.images[0] ?? '',
    isActive: product.isActive,
    categoryIds: product.categoryIds.map((id) => id.toHexString()),
    variants: product.variants.map((variant) => ({
      id: variant._id.toHexString(),
      label: variant.label,
      priceCents: variant.priceCents,
      stock: variant.stock,
      image: variant.image,
      isActive: variant.isActive,
      allowBackorder: variant.allowBackorder,
    })),
  };
}

/** Sacola inteira recusada: e a unica diferenca entre "sem itens" e "total zero". */
function emptyWarning(items: readonly QuoteItem[]): string[] {
  return items.every((item) => item.unavailable) ? [EMPTY_QUOTE_WARNING] : [];
}
