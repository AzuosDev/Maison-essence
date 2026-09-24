/**
 * As configurações da loja, como a API publica as entrega.
 *
 * Espelho de `PublicSettingsView` e `PublicPageSummary` do backend, escrito a
 * mão porque as duas pastas são projetos separados. São os campos que a
 * moldura da loja desenha em toda página — barra de avisos, cabeçalho,
 * rodapé e o botão do WhatsApp.
 */

export interface AddressView {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  reference: string;
}

export interface SocialLinks {
  instagram: string;
  tiktok: string;
}

/** Banner da home, já filtrado pelo agendamento. */
export interface PublicBanner {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
}

export interface PublicSettings {
  storeName: string;
  /** Só digitos, com código do pais: `5588999999999`. */
  whatsappNumber: string;
  /** `https://wa.me/<numero>`, pronto para o `href`. Vazio quando não há número. */
  whatsappLink: string;
  /** O texto que rola na barra preta do topo. */
  announcementText: string;
  contactEmail: string;
  businessHours: string;
  socialLinks: SocialLinks;
  pickupEnabled: boolean;
  pickupAddress: AddressView | null;
  pickupInstructions: string;
  freeShippingMinCents: number | null;
  banners: PublicBanner[];
}

/**
 * Os endereços institucionais são fixos: a dona edita título e conteúdo,
 * nunca o endereço, porque esses links circulam no WhatsApp.
 */
export const INSTITUTIONAL_PAGE_SLUGS = {
  ABOUT: 'quem-somos',
  RETURNS: 'trocas-e-devolucoes',
  FAQ: 'perguntas-frequentes',
  HOW_TO_BUY: 'como-comprar',
  PRIVACY: 'politica-de-privacidade',
} as const;

export type InstitutionalPageSlug =
  (typeof INSTITUTIONAL_PAGE_SLUGS)[keyof typeof INSTITUTIONAL_PAGE_SLUGS];

/** O que o rodapé precisa para montar a lista de links institucionais. */
export interface PublicPageSummary {
  slug: InstitutionalPageSlug;
  title: string;
}

/**
 * Uma página institucional inteira, com o texto.
 *
 * O `slug` e `string`, e não `InstitutionalPageSlug`: as abas da página do
 * produto leem páginas pelo endereço, e a lista fechada pode ganhar um item
 * no backend antes de este arquivo saber dele. O que garante que a página
 * existe não e o tipo — e a listagem de `/pages`, que só traz o que esta
 * publicado.
 *
 * O conteúdo e Markdown, do jeito que a dona escreveu no painel. Quem
 * renderiza e `lib/markdown`.
 */
export interface PublicPage {
  slug: string;
  title: string;
  content: string;
}
