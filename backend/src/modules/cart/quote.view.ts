import type { PaymentMethod } from '../../common/enums/payment-method.js';
import type { DeliveryQuote } from '../delivery/delivery.service.js';
import type { InstallmentOption } from '../payments/installments.js';
import type { QuoteItem } from './cart-lines.js';

/**
 * O pagamento como a cotacao o devolve: o que foi pedido, ja conferido.
 *
 * `selected` e a opcao de parcelamento escolhida, resolvida contra a lista
 * que o servidor calculou — nunca o numero que o cliente mandou. E dela que
 * sai o `hasInterest` que o pedido grava, e por isso ela nao pode ser uma
 * copia do pedido do cliente: no cartao em 12x de um pedido pequeno, a opcao
 * pode simplesmente nao existir.
 */
export interface QuotePaymentView {
  method: PaymentMethod;
  /** O parcelamento que vale: o pedido, ou 1 quando ele nao pode ser oferecido. */
  installments: number;
  selected: InstallmentOption | null;
}

/**
 * A cotacao inteira, recalculada no servidor.
 *
 * `deliveryFeeCents` aparece duas vezes — solto e dentro de `fulfillment` —
 * de proposito: solto porque e uma das parcelas do total e a tela de
 * fechamento o exibe ao lado do subtotal; dentro do `fulfillment` porque la
 * ele vem acompanhado do motivo da isencao e do quanto falta para o frete
 * gratis, que e outra conversa.
 */
export interface CartQuoteView {
  items: QuoteItem[];
  fulfillment: DeliveryQuote;
  payment: QuotePaymentView;
  /** Soma das linhas disponiveis, ja com o desconto por quantidade aplicado. */
  subtotalCents: number;
  /** Quanto o desconto por quantidade retirou. Informativo: ja saiu do subtotal. */
  discountTotalCents: number;
  deliveryFeeCents: number;
  /** Desconto do PIX. Zero no cartao. Incide so sobre o subtotal, nunca sobre a entrega. */
  pixDiscountCents: number;
  /** O que o cliente paga: subtotal menos o desconto do PIX, mais a entrega. */
  totalCents: number;
  /** Vazia no PIX e quando a loja nao aceita cartao. */
  installmentOptions: InstallmentOption[];
  /**
   * O que o cliente precisa saber antes de fechar: item que saiu da sacola,
   * forma de pagamento indisponivel, parcelamento que nao cabe. Nunca e erro
   * — a cotacao com aviso continua valida e some com o total certo.
   */
  warnings: string[];
}
