import {
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  type FulfillmentMode,
  type OrderStatus,
  type PaymentMethod,
} from './admin.types';

/**
 * Como o pedido aparece escrito no painel.
 *
 * Os nomes do contrato (`PENDING_CONTACT`) nao sao os nomes da tela
 * ("Aguardando contato"). A traducao mora aqui, e nao dentro de cada
 * componente, porque o mesmo status aparece na tabela, no detalhe, no
 * seletor e no filtro — e quatro traducoes soltas viram quatro palavras
 * diferentes para o mesmo estado.
 */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING_CONTACT]: 'Aguardando contato',
  [ORDER_STATUSES.CONFIRMED]: 'Confirmado',
  [ORDER_STATUSES.PREPARING]: 'Em preparo',
  [ORDER_STATUSES.SHIPPED]: 'Saiu para entrega',
  [ORDER_STATUSES.DELIVERED]: 'Entregue',
  [ORDER_STATUSES.CANCELLED]: 'Cancelado',
};

/**
 * A ordem do ciclo de vida, para o seletor de status.
 *
 * Nao e a ordem alfabetica nem a do objeto de constantes: e a ordem em que o
 * pedido anda de verdade, que e como a dona procura o proximo passo.
 */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  ORDER_STATUSES.PENDING_CONTACT,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.CANCELLED,
];

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  [FULFILLMENT_MODES.DELIVERY]: 'Entrega',
  [FULFILLMENT_MODES.PICKUP]: 'Retirada',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.PIX]: 'PIX',
  [PAYMENT_METHODS.CARD]: 'Cartao',
};

/**
 * O tom do selo de status.
 *
 * Quatro tons para seis status, porque o que a cor precisa dizer e mais
 * simples que o estado: **este pedido espera voce** (dourado), **esta
 * andando** (tinta), **acabou bem** (verde), **acabou mal** (vermelho). A
 * palavra continua escrita no selo — a cor nunca e o unico portador.
 */
export function statusTone(status: OrderStatus): 'gold' | 'ink' | 'success' | 'danger' {
  if (status === ORDER_STATUSES.PENDING_CONTACT) {
    return 'gold';
  }

  if (status === ORDER_STATUSES.DELIVERED) {
    return 'success';
  }

  return status === ORDER_STATUSES.CANCELLED ? 'danger' : 'ink';
}

/**
 * O link que abre a conversa com o cliente.
 *
 * `wa.me` com o numero em digitos e o codigo do pais. O telefone chega do
 * backend com onze digitos e sem o pais — e ele que a dona ve na tela —,
 * entao o `55` entra aqui, uma vez, em vez de em cada lugar que oferece o
 * botao.
 */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const text = message === undefined || message === '' ? '' : `?text=${encodeURIComponent(message)}`;

  return `https://wa.me/${withCountry}${text}`;
}
