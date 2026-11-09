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

/**
 * Onde o banner aparece na home.
 *
 * `hero` e o carrossel da primeira tela; `middle` e a faixa que corta a
 * página depois da última fileira de produto. A mesma arte e o mesmo
 * acabamento nas duas — o que muda e a vaga, e quem a escolhe e a dona.
 */
export type BannerPlacement = 'hero' | 'middle';

/** Banner da home, já filtrado pelo agendamento. */
export interface PublicBanner {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
  placement: BannerPlacement;
}

/**
 * O brinde por valor de compra, já resolvido pelo servidor.
 *
 * Chega pronto para ser escrito na tela: a frase e a foto já passaram pela
 * regra que decide se a campanha esta de pé — brinde desligado, sem valor
 * meta ou sem nome não vira `null` aqui, vira `gift: null` lá. A loja não
 * decide nada sobre brinde; ela só desenha o que recebeu.
 */
export interface PublicGift {
  /** O subtotal que libera o brinde, em centavos. Sempre maior que zero. */
  minCents: number;
  /** O que se ganha: "um porta hidratante com a melhor pasta árabe dentro". */
  label: string;
  /** `publicId` da foto no Cloudinary. Vazio e legitimo: o balão vive sem ela. */
  image: string;
}

/**
 * Um atalho da fileira de círculos da home, já resolvido pelo servidor.
 *
 * Chega pronto para ser desenhado: só os ligados vêm, e já na ordem da
 * fileira. A loja não decide nada sobre atalho — ela corta pelo número de
 * círculos que cabem e desenha o resto como veio.
 */
export interface PublicShortcut {
  id: string;
  /** O nome embaixo do círculo. */
  label: string;
  /** `publicId` da foto. Vazio e legitimo: o círculo cai na inicial do nome. */
  image: string;
  /** Caminho da loja (`/categorias/hidratantes`) ou endereço inteiro. */
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
  /** O brinde por valor de compra. `null` quando a loja não da brinde hoje. */
  gift: PublicGift | null;
  banners: PublicBanner[];
  /**
   * A fileira de círculos da home, na ordem que a dona montou no painel.
   *
   * Vazia e resposta legitima: significa que ninguém montou a fileira ainda,
   * e a home volta a desenhar as categorias-raiz — que e o que ela fazia
   * antes desta lista existir.
   */
  shortcuts: PublicShortcut[];
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
  /** Como usar e guardar o perfume. E a aba do meio da página do produto. */
  USAGE: 'modo-de-uso',
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
