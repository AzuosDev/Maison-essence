/**
 * As chaves de cache do painel.
 *
 * Raiz própria (`['admin']`), separada da do catálogo, e a separação tem uma
 * consequência prática: sair do painel limpa tudo o que esta debaixo dela
 * sem tocar no catálogo público que a mesma aba talvez esteja mostrando em
 * outra guia.
 *
 * Toda lista carrega os filtros na chave, porque dois filtros diferentes são
 * dois resultados diferentes. E toda escrita inválida a família inteira —
 * `admin.orders()`, `admin.products()` —, nunca uma chave específica: depois
 * de mudar o status de um pedido, a contagem do Início, a lista filtrada e o
 * detalhe estão todos desatualizados.
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
  /** Só a prateleira de pronta entrega. Ausente traz o catálogo inteiro. */
  readyToShip?: boolean;
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
   * A árvore de categorias.
   *
   * Sem parâmetros na chave: a rota devolve tudo, e quem filtra e a tela. Fica
   * debaixo de `['admin']` como o resto, e por isso sair do painel a limpa
   * junto — a árvore que o STAFF viu não pode sobreviver a troca de sessão.
   */
  categories: () => [...adminKeys.all, 'categories'] as const,

  /**
   * As cidades atendidas.
   *
   * Sem parâmetros: a rota devolve todas, ativas e desativadas, e quem
   * recorta e a tela. A ordem que vem dela e a mesma do seletor do checkout.
   */
  deliveryCities: () => [...adminKeys.all, 'delivery-cities'] as const,

  /**
   * As regras de pagamento.
   *
   * Documento único, sem parâmetros. Fica debaixo de `['admin']` como o resto
   * — e a única chave do painel que carrega a chave PIX inteira, e sair do
   * painel precisa limpa-lá junto.
   */
  paymentSettings: () => [...adminKeys.all, 'payment-settings'] as const,

  /**
   * As configurações da loja.
   *
   * Documento único. Carrega os banners agendados e as páginas
   * despublicadas — tudo o que a loja aberta não vê.
   */
  settings: () => [...adminKeys.all, 'settings'] as const,

  /** Os números da abertura do painel. */
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,

  /**
   * A área de sistema.
   *
   * Debaixo da mesma raiz `['admin']` — sair do painel limpa isto junto —,
   * com uma família por tela. A lista de usuários não tem parâmetros na
   * chave porque a rota devolve todo mundo: quem filtra e a tela.
   */
  system: () => [...adminKeys.all, 'system'] as const,
  users: () => [...adminKeys.system(), 'users'] as const,
  audit: () => [...adminKeys.system(), 'audit'] as const,
  auditList: (params: Record<string, unknown> = {}) => [...adminKeys.audit(), params] as const,
  health: () => [...adminKeys.system(), 'health'] as const,
  collections: () => [...adminKeys.system(), 'collections'] as const,
} as const;
