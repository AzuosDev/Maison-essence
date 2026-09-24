import { formatCents } from '../../common/money.js';
import type { FulfillmentMode } from '../../common/enums/fulfillment-mode.js';
import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import type { PaymentMethod } from '../../common/enums/payment-method.js';
import { PAYMENT_METHODS } from '../../common/enums/payment-method.js';
import { formatBrazilianPhone } from './phone.js';

/**
 * A mensagem que o cliente envia para a loja, montada no servidor.
 *
 * Montar isto no frontend seria entregar o texto do pedido a quem tem o
 * console aberto: a dona lê a mensagem e acredita nela — e ela quem confere o
 * total, o endereço e a forma de pagamento antes de separar o perfume. O texto
 * precisa vir do mesmo lugar que gravou o pedido, e o que esta aqui e
 * exatamente o que fica em `Order.whatsappMessage`.
 *
 * Função pura, sem banco e sem HTTP, porque o layout e o tipo de coisa que se
 * confere lendo: cada linha deste arquivo vira uma linha na tela do celular da
 * dona, e um teste que compara texto e mais honesto do que um que conta
 * campos.
 *
 * Sobre a formatação do WhatsApp: `*texto*` vira negrito no aplicativo, e a
 * quebra de linha e `\n` mesmo — o `encodeURIComponent` a transforma em `%0A`,
 * que e o que faz a mensagem chegar quebrada em vez de virar um parágrafo
 * único ilegível.
 */

/** Um item do pedido, como a mensagem precisa dele. */
export interface WhatsappItem {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number;
  discountCents: number;
  lineTotalCents: number;
}

/** O endereço de entrega, já copiado do pedido. */
export interface WhatsappAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
}

/** Como o pedido chega ao cliente. */
export interface WhatsappFulfillment {
  mode: FulfillmentMode;
  cityName: string;
  state: string;
  estimatedDays: number;
  feeCents: number;
  /** Por que a entrega saiu de graça. Vazio quando há taxa. */
  freeReason: string;
  /** `null` na retirada. */
  address: WhatsappAddress | null;
  /** Onde e como retirar, das configurações da loja. */
  pickupInstructions: string;
}

/** A forma de pagamento escolhida, já resolvida contra as regras da loja. */
export interface WhatsappPayment {
  method: PaymentMethod;
  installments: number;
  /** O valor que se repete. Zero no PIX e no pagamento a vista. */
  installmentCents: number;
  /** A primeira parcela, que carrega o centavo do arredondamento. */
  firstInstallmentCents: number;
  hasInterest: boolean;
  /** Quanto o cliente paga no fim, já com juros quando houver. */
  financedTotalCents: number;
}

export interface WhatsappTotals {
  /** Soma das linhas já com o desconto por quantidade descontado. */
  subtotalCents: number;
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
}

export interface WhatsappOrder {
  code: string;
  items: readonly WhatsappItem[];
  customer: { name: string; phone: string };
  fulfillment: WhatsappFulfillment;
  payment: WhatsappPayment;
  totals: WhatsappTotals;
}

/** A mensagem inteira, pronta para o `wa.me`. */
export function buildWhatsappMessage(order: WhatsappOrder): string {
  return [
    `*NOVO PEDIDO* ${order.code}`,
    '',
    '*ITENS*',
    ...order.items.flatMap((item, index) => itemLines(item, index + 1)),
    '',
    '*RESUMO*',
    ...summaryLines(order.totals, order.fulfillment),
    '',
    '*PAGAMENTO*',
    paymentLine(order.payment),
    '',
    '*ENTREGA*',
    ...fulfillmentLines(order.fulfillment),
    '',
    '*CLIENTE*',
    order.customer.name,
    formatBrazilianPhone(order.customer.phone),
  ].join('\n');
}

/**
 * O link que abre a conversa com a mensagem preenchida.
 *
 * Vazio quando a loja ainda não cadastrou o número: o pedido continua gravado
 * e visível no painel, e o que falta e o caminho até o WhatsApp. Devolver um
 * `wa.me/` sem número seria pior — abriria o aplicativo num erro que o cliente
 * não tem como resolver.
 */
export function whatsappUrlOf(storeNumber: string, message: string): string {
  return storeNumber === ''
    ? ''
    : `https://wa.me/${storeNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Duas ou três linhas por item: o que e, quanto custa e o desconto quando há.
 *
 * O item vem numerado porque a dona confere a mensagem contra os frascos que
 * separou na bancada, e "o terceiro" e mais rápido de achar do que o nome
 * inteiro de um árabe que ela leu de relance.
 */
function itemLines(item: WhatsappItem, position: number): string[] {
  const name =
    item.variantLabel === ''
      ? item.productName
      : `${item.productName} - ${item.variantLabel}`;
  const gross = item.unitPriceCents * item.quantity;

  return [
    `${position}. ${name}`,
    `   ${item.quantity} x ${formatCents(item.unitPriceCents)} = ${formatCents(gross)}`,
    ...(item.discountPercent > 0
      ? [`   Desconto ${item.discountPercent}%: -${formatCents(item.discountCents)}`]
      : []),
  ];
}

/**
 * O resumo dos valores, escrito para fechar na conta de quem lê.
 *
 * O subtotal aqui e o bruto — a soma das linhas antes do desconto por
 * quantidade — e não o `subtotalCents` do pedido, que já vem descontado. E a
 * única forma de as quatro linhas somarem o total na ponta do lapis: exibir o
 * subtotal líquido e ainda mostrar a linha de desconto faria o desconto
 * aparecer duas vezes para quem conferisse.
 */
function summaryLines(totals: WhatsappTotals, fulfillment: WhatsappFulfillment): string[] {
  return [
    `Subtotal: ${formatCents(totals.subtotalCents + totals.discountTotalCents)}`,
    ...(totals.discountTotalCents > 0
      ? [`Desconto: -${formatCents(totals.discountTotalCents)}`]
      : []),
    ...(fulfillment.mode === FULFILLMENT_MODES.DELIVERY ? [feeLine(totals, fulfillment)] : []),
    ...(totals.pixDiscountCents > 0
      ? [`Desconto PIX: -${formatCents(totals.pixDiscountCents)}`]
      : []),
    `*TOTAL: ${formatCents(totals.totalCents)}*`,
  ];
}

/** A taxa, ou a isenção com o motivo que a cidade ou a loja deram. */
function feeLine(totals: WhatsappTotals, fulfillment: WhatsappFulfillment): string {
  return totals.deliveryFeeCents === 0
    ? `Entrega: grátis${fulfillment.freeReason === '' ? '' : ` (${fulfillment.freeReason})`}`
    : `Entrega: ${formatCents(totals.deliveryFeeCents)}`;
}

/**
 * Uma linha dizendo como o cliente vai pagar.
 *
 * No cartão parcelado vai junto a primeira parcela quando ela difere das
 * outras. São centavos, e e justamente por serem centavos que precisam estar
 * escritos: a diferença entre "3x de R$ 33,33" e o que a fatura mostra e a
 * primeira dúvida que chega no WhatsApp.
 */
function paymentLine(payment: WhatsappPayment): string {
  if (payment.method === PAYMENT_METHODS.PIX) {
    return 'PIX a vista';
  }

  if (payment.installments <= 1) {
    return 'Cartão a vista';
  }

  const interest = payment.hasInterest
    ? ` com juros (total ${formatCents(payment.financedTotalCents)})`
    : ' sem juros';
  const first =
    payment.firstInstallmentCents === payment.installmentCents
      ? ''
      : ` (primeira de ${formatCents(payment.firstInstallmentCents)})`;

  const valor = formatCents(payment.installmentCents);

  return `Cartão em ${payment.installments}x de ${valor}${interest}${first}`;
}

/** Para onde vai, ou o aviso de que o cliente vem buscar. */
function fulfillmentLines(fulfillment: WhatsappFulfillment): string[] {
  if (fulfillment.mode === FULFILLMENT_MODES.PICKUP) {
    return [
      'Retirada na loja',
      ...(fulfillment.pickupInstructions === '' ? [] : [fulfillment.pickupInstructions]),
    ];
  }

  const address = fulfillment.address;

  return [
    `Entrega em ${fulfillment.cityName}/${fulfillment.state}${deadline(fulfillment.estimatedDays)}`,
    ...(address === null ? [] : addressLines(address)),
  ];
}

/** `Rua X, 123 - Apto 2` e o resto, cada pedaço só quando existe. */
function addressLines(address: WhatsappAddress): string[] {
  const street = [address.street, address.number].filter(Boolean).join(', ');

  return [
    [street, address.complement].filter(Boolean).join(' - '),
    ...(address.district === '' ? [] : [`Bairro: ${address.district}`]),
    ...(address.zipCode === '' ? [] : [`CEP: ${address.zipCode}`]),
    ...(address.reference === '' ? [] : [`Referência: ${address.reference}`]),
  ];
}

/** O prazo combinado, quando a cidade tem um. */
function deadline(estimatedDays: number): string {
  if (estimatedDays <= 0) {
    return '';
  }

  return estimatedDays === 1 ? ' (prazo de 1 dia útil)' : ` (prazo de ${estimatedDays} dias úteis)`;
}
