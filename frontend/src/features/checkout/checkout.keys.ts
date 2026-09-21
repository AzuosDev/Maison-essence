import type { QuoteItem } from '@/features/cart';

/**
 * As chaves do checkout.
 *
 * A cotacao e uma consulta, e nao uma mutacao, apesar de ser um `POST`: ela
 * nao cria nada, nao reserva estoque e pode ser repetida a vontade. Trata-la
 * como consulta e o que permite ao resumo do pedido reagir sozinho a cada
 * mudanca de quantidade, cidade ou forma de pagamento — e o que evita o
 * recalculo repetido quando duas partes da tela pedem o mesmo total.
 *
 * Por isso a chave carrega o corpo inteiro da cotacao: e ele que define o
 * resultado. Mudou a cidade, mudou a chave, e ha uma consulta nova.
 */

/** O corpo de `POST /cart/quote`, como a tela o monta. */
export interface QuoteInput {
  items: QuoteItem[];
  fulfillment: {
    /** Entrega na cidade atendida ou retirada na loja. */
    mode: 'DELIVERY' | 'PICKUP';
    /** Obrigatorio na entrega, ausente na retirada. */
    cityId?: string;
  };
  payment: {
    method: 'PIX' | 'CARD';
    /** So no cartao. */
    installments?: number;
  };
}

export const checkoutKeys = {
  all: ['checkout'] as const,

  /** O total calculado no servidor para exatamente este corpo. */
  quote: (input: QuoteInput) => [...checkoutKeys.all, 'quote', input] as const,

  /** As cidades atendidas e a taxa de cada uma: `GET /delivery-cities`. */
  deliveryCities: () => [...checkoutKeys.all, 'delivery-cities'] as const,
} as const;
