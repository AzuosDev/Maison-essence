/**
 * As chaves de cache da conta do cliente.
 *
 * Raiz própria (`['account']`), separada da do catálogo e da do painel. A
 * separação tem uma consequência prática: **sair da conta remove tudo o que
 * esta debaixo dela** e não toca no catálogo que a mesma aba esta mostrando.
 * Sem isso, a próxima pessoa a usar o navegador da família abriria
 * `/conta/pedidos` e veria, por um instante, a lista de quem saiu — servida
 * do cache, antes de o primeiro `401` chegar.
 */

export const accountKeys = {
  all: ['account'] as const,

  /** A conta inteira, com os endereços: `GET /customer/me`. */
  profile: () => [...accountKeys.all, 'profile'] as const,

  orders: () => [...accountKeys.all, 'orders'] as const,
  orderList: (page: number) => [...accountKeys.orders(), { page }] as const,

  /** Pelo código, e não pelo id: e o código que esta na URL e no WhatsApp. */
  order: (code: string) => [...accountKeys.orders(), 'detail', code] as const,
} as const;
