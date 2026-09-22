/**
 * As chaves de cache do painel.
 *
 * Raiz propria (`['admin']`), separada da do catalogo, e a separacao tem uma
 * consequencia pratica: sair do painel limpa tudo o que esta debaixo dela
 * sem tocar no catalogo publico que a mesma aba talvez esteja mostrando em
 * outra guia.
 *
 * Toda lista carrega os filtros na chave, porque dois filtros diferentes sao
 * dois resultados diferentes. E toda escrita invalida a familia inteira —
 * `admin.orders()`, `admin.products()` —, nunca uma chave especifica: depois
 * de mudar o status de um pedido, a contagem do Inicio, a lista filtrada e o
 * detalhe estao todos desatualizados.
 */

export interface AdminOrderListParams {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface AdminProductListParams {
  q?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export const adminKeys = {
  all: ['admin'] as const,

  orders: () => [...adminKeys.all, 'orders'] as const,
  orderList: (params: AdminOrderListParams = {}) => [...adminKeys.orders(), params] as const,
  order: (id: string) => [...adminKeys.orders(), 'detail', id] as const,

  products: () => [...adminKeys.all, 'products'] as const,
  productList: (params: AdminProductListParams = {}) => [...adminKeys.products(), params] as const,
  product: (id: string) => [...adminKeys.products(), 'detail', id] as const,

  /** Os numeros da abertura do painel. */
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
} as const;
