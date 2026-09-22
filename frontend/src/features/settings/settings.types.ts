/**
 * As configuracoes da loja, como a API publica as entrega.
 *
 * Espelho de `PublicSettingsView` e `PublicPageSummary` do backend, escrito a
 * mao porque as duas pastas sao projetos separados. Sao os campos que a
 * moldura da loja desenha em toda pagina — barra de avisos, cabecalho,
 * rodape e o botao do WhatsApp.
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

/** Banner da home, ja filtrado pelo agendamento. */
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
  /** So digitos, com codigo do pais: `5588999999999`. */
  whatsappNumber: string;
  /** `https://wa.me/<numero>`, pronto para o `href`. Vazio quando nao ha numero. */
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
 * Os enderecos institucionais sao fixos: a dona edita titulo e conteudo,
 * nunca o endereco, porque esses links circulam no WhatsApp.
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

/** O que o rodape precisa para montar a lista de links institucionais. */
export interface PublicPageSummary {
  slug: InstitutionalPageSlug;
  title: string;
}
