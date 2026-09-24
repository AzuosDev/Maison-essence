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
 *
 * ## Importe este arquivo direto, e nao o barril
 *
 * A sacola e a entrega precisam destas chaves, e o checkout precisa das
 * duas: `use-checkout-quote` chama `useCart` e `useDeliveryCities`. Se elas
 * pedissem `checkoutKeys` a `@/features/checkout`, os tres barris fechariam
 * um ciclo em tempo de execucao, com dois stores do Zustand criados no meio
 * dele — o tipo de arranjo que funciona ate o dia em que a ordem de
 * avaliacao muda e um `create()` roda com um import ainda pela metade.
 *
 * Este modulo nao importa nada em tempo de execucao: so um tipo, que o
 * `verbatimModuleSyntax` apaga na compilacao. Importa-lo direto e o que
 * mantem o grafo aciclico.
 */

/** O corpo de `POST /cart/quote`, como a tela o monta. */
export interface QuoteInput {
  items: QuoteItem[];
  fulfillment: {
    /** Entrega na cidade atendida ou retirada na loja. */
    mode: 'delivery' | 'pickup';
    /** Obrigatorio na entrega, ausente na retirada. */
    cityId?: string;
  };
  payment: {
    method: 'pix' | 'card';
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
