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
  /** `all`, `active` ou `inactive`. Ausente vale como `all`. */
  status?: string;
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

  /**
   * A arvore de categorias.
   *
   * Sem parametros na chave: a rota devolve tudo, e quem filtra e a tela. Fica
   * debaixo de `['admin']` como o resto, e por isso sair do painel a limpa
   * junto — a arvore que o STAFF viu nao pode sobreviver a troca de sessao.
   */
  categories: () => [...adminKeys.all, 'categories'] as const,

  /**
   * As cidades atendidas.
   *
   * Sem parametros: a rota devolve todas, ativas e desativadas, e quem
   * recorta e a tela. A ordem que vem dela e a mesma do seletor do checkout.
   */
  deliveryCities: () => [...adminKeys.all, 'delivery-cities'] as const,

  /**
   * As regras de pagamento.
   *
   * Documento unico, sem parametros. Fica debaixo de `['admin']` como o resto
   * — e a unica chave do painel que carrega a chave PIX inteira, e sair do
   * painel precisa limpa-la junto.
   */
  paymentSettings: () => [...adminKeys.all, 'payment-settings'] as const,

  /** Os numeros da abertura do painel. */
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,

  /**
   * A area de sistema.
   *
   * Debaixo da mesma raiz `['admin']` — sair do painel limpa isto junto —,
   * com uma familia por tela. A lista de usuarios nao tem parametros na
   * chave porque a rota devolve todo mundo: quem filtra e a tela.
   */
  system: () => [...adminKeys.all, 'system'] as const,
  users: () => [...adminKeys.system(), 'users'] as const,
  audit: () => [...adminKeys.system(), 'audit'] as const,
  auditList: (params: Record<string, unknown> = {}) => [...adminKeys.audit(), params] as const,
  health: () => [...adminKeys.system(), 'health'] as const,
  collections: () => [...adminKeys.system(), 'collections'] as const,
} as const;
