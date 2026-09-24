/**
 * A chave de cache das formas de pagamento.
 *
 * Uma só, por enquanto — mas com a mesma raiz das que virão no checkout, para
 * que invalidar pagamento continue sendo uma linha quando a dona mexer nas
 * regras pelo painel.
 */
export const paymentKeys = {
  all: ['payments'] as const,

  settings: () => [...paymentKeys.all, 'settings'] as const,
} as const;
