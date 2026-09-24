import type { PaymentMethod } from '../../common/enums/payment-method.js';
import type { DeliveryQuote } from '../delivery/delivery.service.js';
import type { InstallmentOption } from '../payments/installments.js';
import type { QuoteItem } from './cart-lines.js';

/**
 * O pagamento como a cotação o devolve: o que foi pedido, já conferido.
 *
 * `selected` e a opção de parcelamento escolhida, resolvida contra a lista
 * que o servidor calculou — nunca o número que o cliente mandou. E dela que
 * sai o `hasInterest` que o pedido grava, e por isso ela não pode ser uma
 * copia do pedido do cliente: no cartão em 12x de um pedido pequeno, a opção
 * pode simplesmente não existir.
 */
export interface QuotePaymentView {
  method: PaymentMethod;
  /** O parcelamento que vale: o pedido, ou 1 quando ele não pode ser oferecido. */
  installments: number;
  selected: InstallmentOption | null;
}

/**
 * A cotação inteira, recalculada no servidor.
 *
 * `deliveryFeeCents` aparece duas vezes — solto e dentro de `fulfillment` —
 * de propósito: solto porque e uma das parcelas do total e a tela de
 * fechamento o exibe ao lado do subtotal; dentro do `fulfillment` porque lá
 * ele vem acompanhado do motivo da isenção e do quanto falta para o frete
 * grátis, que e outra conversa.
 */
export interface CartQuoteView {
  items: QuoteItem[];
  fulfillment: DeliveryQuote;
  payment: QuotePaymentView;
  /** Soma das linhas disponíveis, já com o desconto por quantidade aplicado. */
  subtotalCents: number;
  /** Quanto o desconto por quantidade retirou. Informativo: já saiu do subtotal. */
  discountTotalCents: number;
  deliveryFeeCents: number;
  /** Desconto do PIX. Zero no cartão. Incide só sobre o subtotal, nunca sobre a entrega. */
  pixDiscountCents: number;
  /** O que o cliente paga: subtotal menos o desconto do PIX, mais a entrega. */
  totalCents: number;
  /** Vazia no PIX e quando a loja não aceita cartão. */
  installmentOptions: InstallmentOption[];
  /**
   * O que o cliente precisa saber antes de fechar: item que saiu da sacola,
   * forma de pagamento indisponível, parcelamento que não cabe. Nunca e erro
   * — a cotação com aviso continua valida e some com o total certo.
   */
  warnings: string[];
}
