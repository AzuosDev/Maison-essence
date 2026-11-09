import type { CardMode } from '../../common/enums/card-mode.js';
import type { PaymentMethod } from '../../common/enums/payment-method.js';
import type { AppliedCouponView } from '../coupons/coupon.view.js';
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
  /**
   * Por onde o cartão vai ser cobrado. `null` no PIX e enquanto o cliente
   * ainda não escolheu — e a lista de parcelas vem vazia junto.
   */
  cardMode: CardMode | null;
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
  /**
   * O cupom aplicado a esta sacola, ou `null`.
   *
   * `null` com um aviso em `warnings` e o código que não pegou: venceu,
   * esgotou, não existe ou não alcança nenhum item daqui. A cotação continua
   * valendo nos quatro casos.
   */
  coupon: AppliedCouponView | null;
  /**
   * Quanto o cupom retirou. Zero sem cupom.
   *
   * Linha própria, como `pixDiscountCents`, e **fora** do `subtotalCents` de
   * propósito: o subtotal e o que a cliente levou em produtos, e e por ele que
   * se mede a meta do brinde e a do frete grátis. O cupom entra depois, sobre o
   * que ela vai pagar.
   */
  couponDiscountCents: number;
  /**
   * Por que o código digitado não pegou. Vazio quando pegou, e sem código.
   *
   * Campo próprio, e **fora** de `warnings`, porque e a única mensagem desta
   * resposta que pertence a um campo do formulário: ela vai embaixo da caixa
   * do cupom, onde quem digitou esta olhando. Misturada nos avisos gerais —
   * item que saiu da sacola, cartão indisponível — ela apareceria longe da
   * causa, ou não apareceria, porque a sacola não desenha aquela lista.
   *
   * Nunca derruba a cotação: código errado volta com o total dos seis itens
   * e a frase do motivo, e não com um erro que apaga a tela.
   */
  couponWarning: string;
  deliveryFeeCents: number;
  /**
   * Desconto do PIX. Zero no cartão. Nunca incide sobre a entrega.
   *
   * Calculado sobre o subtotal **já descontado pelo cupom**: dois percentuais
   * sobre o mesmo valor cheio somariam mais do que a loja tirou, e a conta do
   * pedido não fecharia com o que a tela mostrou.
   */
  pixDiscountCents: number;
  /**
   * O que os produtos custam depois dos descontos, **sem a entrega**.
   *
   * Subtotal menos cupom e menos PIX. Existe para um caso só, e ele e real: a
   * tela de fechamento mostra os valores antes de o cliente escolher entrega
   * ou retirada, e nessa altura a taxa que a cotação devolve e de uma cidade
   * que ninguém escolheu. Até então o resumo exibia o `subtotalCents` como
   * total — o que ficou errado no dia em que o cupom entrou: a lista mostrava
   * "Subtotal 189,90 / Cupom -37,98 / Total 189,90", uma soma que não fecha.
   *
   * Vem do servidor em vez de ser subtraído no navegador porque e dinheiro, e
   * a regra desta API e a de sempre: nenhuma conta de valor acontece na tela.
   */
  payableCents: number;
  /** O que o cliente paga: subtotal menos cupom e PIX, mais a entrega. */
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
