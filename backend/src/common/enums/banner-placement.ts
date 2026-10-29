/**
 * Onde o banner aparece na home.
 *
 * Duas vagas, e as duas são a mesma arte com o mesmo acabamento: a do topo
 * gira em carrossel acima das categorias, a do meio corta a página entre a
 * última fileira de produto e o convite do Instagram. A vaga e do banner, e
 * não da tela, porque quem decide o que ocupa cada uma e a dona pelo painel —
 * trocar uma campanha de lugar não pode exigir deploy.
 */
export const BANNER_PLACEMENTS = {
  /** O carrossel da primeira tela. E o LCP da home. */
  HERO: 'hero',
  /** A faixa do meio da página, depois da última fileira de produto. */
  MIDDLE: 'middle',
} as const;

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[keyof typeof BANNER_PLACEMENTS];

export const BANNER_PLACEMENT_VALUES: readonly BannerPlacement[] =
  Object.values(BANNER_PLACEMENTS);
