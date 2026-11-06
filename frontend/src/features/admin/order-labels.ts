import {
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  type AdminOrderPayment,
  type FulfillmentMode,
  type OrderStatus,
  type PaymentMethod,
} from './admin.types';

/**
 * Como o pedido aparece escrito no painel.
 *
 * Os nomes do contrato (`PENDING_CONTACT`) não são os nomes da tela
 * ("Processando"). A tradução mora aqui, e não dentro de cada componente,
 * porque o mesmo status aparece na tabela, no detalhe, no seletor e no
 * filtro — e quatro traduções soltas viram quatro palavras diferentes para o
 * mesmo estado.
 *
 * ## Os nomes da dona, e os valores que o banco já tem
 *
 * A dona nomeou o ciclo em quatro passos — processando, saiu para entrega,
 * entregue, vendido —, mais o cancelamento. Os valores gravados continuam os
 * mesmos de antes, porque renomear no banco pediria migração em pedido já
 * fechado, e o nome interno não aparece em tela nenhuma:
 *
 * | Na tela            | No banco          |
 * | ------------------ | ----------------- |
 * | Processando        | `PENDING_CONTACT` |
 * | Saiu para entrega  | `SHIPPED`         |
 * | Entregue           | `DELIVERED`       |
 * | Vendido            | `CONFIRMED`       |
 * | Cancelado          | `CANCELLED`       |
 *
 * `PREPARING` sobrou do ciclo antigo e não entra mais no seletor. Ele
 * continua traduzido porque pode haver pedido parado nele: um status sem
 * rótulo apareceria como célula vazia na tabela, e "(antigo)" e o aviso de
 * que aquele pedido precisa ser movido para um dos cinco de agora.
 */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING_CONTACT]: 'Processando',
  [ORDER_STATUSES.SHIPPED]: 'Saiu para entrega',
  [ORDER_STATUSES.DELIVERED]: 'Entregue',
  [ORDER_STATUSES.CONFIRMED]: 'Vendido',
  [ORDER_STATUSES.CANCELLED]: 'Cancelado',
  [ORDER_STATUSES.PREPARING]: 'Processando (antigo)',
};

/**
 * A ordem do ciclo de vida, para o seletor e para o filtro.
 *
 * Não e a ordem alfabética nem a do objeto de constantes: e a ordem em que o
 * pedido anda de verdade, que e como a dona procura o próximo passo.
 * "Vendido" vem depois de "Entregue" porque e a venda fechada e paga — o
 * último passo, e não a confirmação do começo.
 */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  ORDER_STATUSES.PENDING_CONTACT,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.CANCELLED,
];

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  [FULFILLMENT_MODES.DELIVERY]: 'Entrega',
  [FULFILLMENT_MODES.PICKUP]: 'Retirada',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.PIX]: 'PIX',
  [PAYMENT_METHODS.CARD]: 'Cartão',
};

/**
 * As opções do filtro e do seletor de status.
 *
 * Derivadas do fluxo e dos rótulos, e não escritas a mão: um status novo no
 * domínio aparece nos dois controles sem ninguém lembrar de acrescenta-lo.
 * O tipo e o mínimo que `<Select>` pede, para que este módulo continue sem
 * saber que existe um design system do outro lado.
 */
export const ORDER_STATUS_OPTIONS: readonly { value: OrderStatus; label: string }[] =
  ORDER_STATUS_FLOW.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] }));

/**
 * Como o pagamento cabe numa célula: `PIX`, `Cartao`, `Cartao 6x`.
 *
 * O número de parcelas entra só quando há mais de uma — "Cartão 1x" e ruído,
 * e a coluna existe para ser lida de relance. Se há juros ou não fica de
 * fora aqui de propósito: e uma frase, não um rótulo, e o detalhe do pedido
 * a escreve por extenso.
 */
export function paymentLabel(payment: AdminOrderPayment): string {
  const method = PAYMENT_LABELS[payment.method];

  if (payment.method !== PAYMENT_METHODS.CARD || payment.installments <= 1) {
    return method;
  }

  return `${method} ${String(payment.installments)}x`;
}

/**
 * O tom do selo de status.
 *
 * Quatro tons para seis status, porque o que a cor precisa dizer e mais
 * simples que o estado: **este pedido espera você** (dourado, processando),
 * **esta andando** (tinta, saiu para entrega), **acabou bem** (verde,
 * entregue e vendido), **acabou mal** (vermelho). A palavra continua escrita
 * no selo — a cor nunca e o único portador.
 */
export function statusTone(status: OrderStatus): 'gold' | 'ink' | 'success' | 'danger' {
  if (status === ORDER_STATUSES.PENDING_CONTACT || status === ORDER_STATUSES.PREPARING) {
    return 'gold';
  }

  if (status === ORDER_STATUSES.DELIVERED || status === ORDER_STATUSES.CONFIRMED) {
    return 'success';
  }

  return status === ORDER_STATUSES.CANCELLED ? 'danger' : 'ink';
}

/**
 * O link que abre a conversa com o cliente.
 *
 * `wa.me` com o número em digitos e o código do pais. O telefone chega do
 * backend com onze digitos e sem o pais — e ele que a dona vê na tela —,
 * então o `55` entra aqui, uma vez, em vez de em cada lugar que oferece o
 * botão.
 */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const text =
    message === undefined || message === '' ? '' : `?text=${encodeURIComponent(message)}`;

  return `https://wa.me/${withCountry}${text}`;
}
