import type { QuoteItem } from '@/features/cart';

/**
 * As chaves do checkout.
 *
 * A cotação e uma consulta, e não uma mutação, apesar de ser um `POST`: ela
 * não cria nada, não reserva estoque e pode ser repetida a vontade. Trata-lá
 * como consulta e o que permite ao resumo do pedido reagir sozinho a cada
 * mudanca de quantidade, cidade ou forma de pagamento — e o que evita o
 * recálculo repetido quando duas partes da tela pedem o mesmo total.
 *
 * Por isso a chave carrega o corpo inteiro da cotação: e ele que define o
 * resultado. Mudou a cidade, mudou a chave, e há uma consulta nova.
 *
 * ## Importe este arquivo direto, e não o barril
 *
 * A sacola e a entrega precisam destas chaves, e o checkout precisa das
 * duas: `use-checkout-quote` chama `useCart` e `useDeliveryCities`. Se elas
 * pedissem `checkoutKeys` a `@/features/checkout`, os três barris fechariam
 * um ciclo em tempo de execução, com dois stores do Zustand criados no meio
 * dele — o tipo de arranjo que funciona até o dia em que a ordem de
 * avaliação muda e um `create()` roda com um import ainda pela metade.
 *
 * Este módulo não importa nada em tempo de execução: só um tipo, que o
 * `verbatimModuleSyntax` apaga na compilação. Importa-lo direto e o que
 * mantem o grafo acíclico.
 */

/** O corpo de `POST /cart/quote`, como a tela o monta. */
export interface QuoteInput {
  items: QuoteItem[];
  fulfillment: {
    /** Entrega na cidade atendida ou retirada na loja. */
    mode: 'delivery' | 'pickup';
    /** Obrigatório na entrega, ausente na retirada. */
    cityId?: string;
  };
  payment: {
    method: 'pix' | 'card';
    /** Só no cartão. */
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
