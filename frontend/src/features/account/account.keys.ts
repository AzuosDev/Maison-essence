/**
 * As chaves de cache da conta do cliente.
 *
 * Raiz propria (`['account']`), separada da do catalogo e da do painel. A
 * separacao tem uma consequencia pratica: **sair da conta remove tudo o que
 * esta debaixo dela** e nao toca no catalogo que a mesma aba esta mostrando.
 * Sem isso, a proxima pessoa a usar o navegador da familia abriria
 * `/conta/pedidos` e veria, por um instante, a lista de quem saiu — servida
 * do cache, antes de o primeiro `401` chegar.
 */

export const accountKeys = {
  all: ['account'] as const,

  /** A conta inteira, com os enderecos: `GET /customer/me`. */
  profile: () => [...accountKeys.all, 'profile'] as const,

  orders: () => [...accountKeys.all, 'orders'] as const,
  orderList: (page: number) => [...accountKeys.orders(), { page }] as const,

  /** Pelo codigo, e nao pelo id: e o codigo que esta na URL e no WhatsApp. */
  order: (code: string) => [...accountKeys.orders(), 'detail', code] as const,
} as const;
