import type { InstitutionalPageSlug } from '../../common/enums/institutional-page.js';
import { liveBanners } from './banners.js';
import { mergeInstitutionalPages } from './institutional-pages.js';
import type { EditablePage } from './institutional-pages.js';
import type {
  Banner,
  InstitutionalPage,
  PickupAddress,
  SocialLinks,
  StoreSettingsDocument,
} from './schemas/store-settings.schema.js';
import { whatsappLinkOf } from './whatsapp-number.js';

/** Endereço de retirada como as duas pontas o veem. */
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

export interface SocialLinksView {
  instagram: string;
  tiktok: string;
}

/** Banner como o painel o edita: com o agendamento a mostra. */
export interface BannerView {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
  order: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

/**
 * Banner como a home o recebe.
 *
 * Sem `isActive` e sem as datas de propósito: o que chega a vitrine já passou
 * pelo filtro do agendamento, e a campanha que a dona deixou programada para
 * a Black Friday não precisa circular no HTML da loja duas semanas antes.
 */
export interface PublicBannerView {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
}

/** Página institucional no painel. */
export interface PageView extends EditablePage {}

/** Página institucional aberta no site. */
export interface PublicPageView {
  slug: InstitutionalPageSlug;
  title: string;
  content: string;
}

/** O que o rodapé precisa para montar a lista de links. */
export interface PublicPageSummary {
  slug: InstitutionalPageSlug;
  title: string;
}

/** As configurações como o painel as vê: tudo, inclusive o que não esta no ar. */
export interface SettingsView {
  storeName: string;
  whatsappNumber: string;
  announcementText: string;
  contactEmail: string;
  businessHours: string;
  pickupEnabled: boolean;
  pickupAddress: AddressView;
  pickupInstructions: string;
  socialLinks: SocialLinksView;
  /** Mínimo para frete grátis em qualquer cidade. `null` desliga a regra. */
  freeShippingMinCents: number | null;
  banners: BannerView[];
  institutionalPages: PageView[];
  updatedAt: Date;
}

/**
 * As configurações como a loja aberta as vê.
 *
 * Subconjunto seguro: fica de fora tudo que e estado do painel — banner
 * agendado ou desligado, página despublicada, o `updatedAt` que denuncia
 * quando a dona mexeu na loja. O que entra e o que o site desenha em toda
 * página: cabeçalho, rodapé, barra de avisos e o botão do WhatsApp.
 */
export interface PublicSettingsView {
  storeName: string;
  whatsappNumber: string;
  /** Pronto para o `href`. Vazio quando a loja ainda não tem número. */
  whatsappLink: string;
  announcementText: string;
  contactEmail: string;
  businessHours: string;
  socialLinks: SocialLinksView;
  pickupEnabled: boolean;
  /** `null` quando a retirada esta desligada: endereço que não se usa não sai. */
  pickupAddress: AddressView | null;
  pickupInstructions: string;
  /**
   * Mínimo para frete grátis, para a sacola dizer quanto falta. Sai aqui e
   * não só na lista de cidades porque a barra de "faltam R$ 30,00" aparece
   * antes de o cliente escolher para onde a entrega vai.
   */
  freeShippingMinCents: number | null;
  banners: PublicBannerView[];
}

export function toSettingsView(settings: StoreSettingsDocument): SettingsView {
  return {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    announcementText: settings.announcementText,
    contactEmail: settings.contactEmail,
    businessHours: settings.businessHours,
    pickupEnabled: settings.pickupEnabled,
    pickupAddress: toAddressView(settings.pickupAddress),
    pickupInstructions: settings.pickupInstructions,
    socialLinks: toSocialLinksView(settings.socialLinks),
    freeShippingMinCents: settings.freeShippingMinCents,
    // Ordenados como a home os exibe, para a tela do painel bater com o site.
    banners: [...settings.banners]
      .sort((first, second) => first.order - second.order)
      .map(toBannerView),
    institutionalPages: toPageViews(settings),
    updatedAt: settings.updatedAt,
  };
}

export function toPublicSettingsView(
  settings: StoreSettingsDocument,
  now: Date,
): PublicSettingsView {
  return {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    whatsappLink: whatsappLinkOf(settings.whatsappNumber),
    announcementText: settings.announcementText,
    contactEmail: settings.contactEmail,
    businessHours: settings.businessHours,
    socialLinks: toSocialLinksView(settings.socialLinks),
    pickupEnabled: settings.pickupEnabled,
    pickupAddress: settings.pickupEnabled ? toAddressView(settings.pickupAddress) : null,
    pickupInstructions: settings.pickupEnabled ? settings.pickupInstructions : '',
    freeShippingMinCents: settings.freeShippingMinCents,
    banners: liveBanners(settings.banners, now).map(toPublicBannerView),
  };
}

/** As cinco páginas, com o que estiver gravado por cima dos padrões. */
export function toPageViews(settings: StoreSettingsDocument): PageView[] {
  return mergeInstitutionalPages(settings.institutionalPages.map(toEditablePage));
}

/** Só as publicadas, na ordem do painel. */
export function toPublicPageSummaries(settings: StoreSettingsDocument): PublicPageSummary[] {
  return toPageViews(settings)
    .filter((page) => page.isActive)
    .map(({ slug, title }) => ({ slug, title }));
}

export function toPublicPageView(page: PageView): PublicPageView {
  return { slug: page.slug, title: page.title, content: page.content };
}

export function toEditablePage(page: InstitutionalPage): EditablePage {
  return {
    slug: page.slug,
    title: page.title,
    content: page.content,
    isActive: page.isActive,
  };
}

export function toBannerView(banner: Banner): BannerView {
  return {
    id: banner.id,
    imageDesktop: banner.imageDesktop,
    imageMobile: banner.imageMobile,
    title: banner.title,
    subtitle: banner.subtitle,
    buttonLabel: banner.buttonLabel,
    link: banner.link,
    order: banner.order,
    startsAt: banner.startsAt,
    endsAt: banner.endsAt,
    isActive: banner.isActive,
  };
}

export function toPublicBannerView(banner: Banner): PublicBannerView {
  return {
    id: banner.id,
    imageDesktop: banner.imageDesktop,
    // O celular cai na arte de desktop quando não há arte própria.
    imageMobile: banner.imageMobile || banner.imageDesktop,
    title: banner.title,
    subtitle: banner.subtitle,
    buttonLabel: banner.buttonLabel,
    link: banner.link,
  };
}

function toAddressView(address: PickupAddress): AddressView {
  return {
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    reference: address.reference,
  };
}

function toSocialLinksView(links: SocialLinks): SocialLinksView {
  return { instagram: links.instagram, tiktok: links.tiktok };
}
