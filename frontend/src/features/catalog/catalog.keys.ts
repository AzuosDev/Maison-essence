/**
 * As chaves de cache do catalogo.
 *
 * Toda chave do TanStack Query nasce aqui, e nenhuma e escrita a mao dentro
 * de um componente. O motivo e a invalidacao: quando o painel salva um
 * produto, alguem precisa dizer "esqueca tudo o que e catalogo", e isso so
 * funciona se as chaves compartilharem o mesmo prefixo. Chave escrita a mao
 * em uma tela e a chave que ninguem invalida.
 *
 * O formato segue a hierarquia do proprio cache: `['catalog']` e a raiz,
 * `['catalog', 'products']` e a familia, e a lista inclui os filtros, porque
 * duas buscas diferentes sao dois resultados diferentes.
 */

/** Filtros da vitrine, como `GET /products` os aceita. */
export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  [key: string]: string | number | boolean | undefined;
}

export const catalogKeys = {
  all: ['catalog'] as const,

  products: () => [...catalogKeys.all, 'products'] as const,
  productList: (params: ProductListParams = {}) => [...catalogKeys.products(), params] as const,
  product: (slug: string) => [...catalogKeys.products(), 'detail', slug] as const,

  /** As prateleiras da home: destaques, pronta entrega e mais vendidos. */
  shelf: (name: 'featured' | 'ready-to-ship' | 'best-sellers', limit?: number) =>
    [...catalogKeys.all, 'shelf', name, limit ?? null] as const,

  categories: () => [...catalogKeys.all, 'categories'] as const,
  category: (slug: string) => [...catalogKeys.categories(), slug] as const,
} as const;
