/**
 * A campanha, como `GET /campaigns/live` e `GET /campaigns/:slug` a devolvem.
 *
 * Espelho de `PublicCampaignView` no backend, escrito a mão porque as duas
 * pastas são projetos separados.
 *
 * O que **não** esta aqui e proposital, e e a parte importante deste tipo:
 * `usedCount`, `maxUses`, `holdingCount` e `productIds` não viajam para a loja
 * aberta. Os três primeiros são a operação da dona e não dizem nada a quem
 * esta comprando — o que diz e `scarcityLabel`, e só quando aperta. O quarto
 * fica fora porque a vitrine da campanha vem de `GET /products?campaign=`, a
 * mesma rota do catálogo, que já sabe montar card com preço, parcela e selo.
 */
export interface PublicCampaign {
  /** O código que a cliente digita no fechamento. */
  code: string;
  title: string;
  /** O endereço da vitrine da campanha: `/promocao/<slug>`. */
  slug: string;
  tagline: string;
  percentOff: number | null;
  amountOffCents: number | null;
  /** `20% OFF` ou `R$ 30,00 OFF`, escrito pelo servidor. */
  discountLabel: string;
  /** Quando a campanha sai do ar, em ISO. `null` e "até segunda ordem". */
  endsAt: string | null;
  /** O cupom vale no catálogo inteiro: não ha vitrine própria a montar. */
  wholeStore: boolean;
  /**
   * `Restam 7 cupons`, ou vazio.
   *
   * Vazio em três casos, e o terceiro e o que mais importa: cupom sem teto,
   * teto folgado e cupom **esgotado**. Anunciar "restam 0" seria a loja
   * gastando a faixa da home para dizer que a cliente chegou tarde.
   */
  scarcityLabel: string;
}

/**
 * A resposta de `GET /campaigns/live`.
 *
 * Um objeto com um campo, e não a campanha solta, porque a ausência precisa
 * ser legível: `{ campaign: null }` diz "consultei e não ha nenhuma", enquanto
 * um `null` solto chega ao navegador como corpo vazio. Loja sem campanha e o
 * caso comum, não a exceção.
 */
export interface LiveCampaignResponse {
  campaign: PublicCampaign | null;
}
