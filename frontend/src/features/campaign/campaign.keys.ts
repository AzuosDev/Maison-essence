/**
 * As chaves de cache da campanha.
 *
 * Família própria, e não debaixo de `catalog`: a campanha não e produto, e
 * quem inválida o catálogo — a dona salvando um perfume no painel — não tem
 * motivo para derrubar a faixa da home junto. Os **produtos** da campanha,
 * esses sim, são catálogo, e vivem em `catalogKeys.productList({ campaign })`.
 */
export const campaignKeys = {
  all: ['campaign'] as const,

  /** A campanha que a home anuncia: `GET /campaigns/live`. */
  live: () => [...campaignKeys.all, 'live'] as const,

  /** A campanha de um endereço: `GET /campaigns/:slug`. */
  bySlug: (slug: string) => [...campaignKeys.all, 'detail', slug] as const,
} as const;
