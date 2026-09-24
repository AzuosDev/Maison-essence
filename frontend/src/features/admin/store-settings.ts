import { INSTITUTIONAL_PAGE_SLUGS, type InstitutionalPageSlug } from '@/features/settings';
import { centsFromInput, centsToInput, dateInputValue, dayEndISO, dayStartISO } from '@/lib/format';
import {
  SETTINGS_LIMITS,
  type AdminBanner,
  type AdminInstitutionalPage,
  type AdminPickupAddress,
  type AdminStoreSettings,
  type BannerInput,
  type InstitutionalPageInput,
  type UpdateStoreSettingsInput,
} from './admin.types';

/**
 * As configuracoes da loja, enquanto estao sendo editadas.
 *
 * ## Uma tela, cinco assuntos, um rascunho so
 *
 * Nome da loja, retirada, redes, carrossel e paginas sao coisas diferentes,
 * mas moram no mesmo documento e sao gravadas pelo mesmo `PATCH`. Um rascunho
 * unico e o que permite uma barra de salvar so — e a dona que entrou para
 * trocar o texto da barra de avisos e acabou corrigindo o CEP nao precisa
 * descobrir que sao dois botoes diferentes.
 *
 * ## Por que a comparacao acontece no espaco do rascunho
 *
 * `changesOf` compara o rascunho com **outro rascunho** — o que sairia de
 * `draftFromSettings` agora —, e nao com o documento do servidor. A razao e a
 * data do banner: o servidor guarda um instante, a tela mostra um dia, e a
 * volta do dia para o instante nao devolve exatamente o que estava la. Se a
 * comparacao acontecesse no espaco do servidor, toda abertura da tela acharia
 * que os banners mudaram, e a barra de salvar apareceria sozinha.
 *
 * ## Tres significados de vazio, de novo
 *
 * - **barra de avisos vazia** tira a barra do ar. E o jeito de desliga-la;
 * - **frete gratis vazio** e `null`: a loja nao tem minimo geral, e cada
 *   cidade responde pela sua regra;
 * - **e-mail de contato vazio** nao pode ser enviado. O servidor valida o
 *   campo como e-mail e recusa o texto vazio, entao apagar um e-mail ja
 *   gravado e uma coisa que o painel nao consegue fazer — e dizer isso e
 *   melhor do que devolver um 400 sem explicacao.
 */

/* ---- O rascunho ------------------------------------------------------------- */

/** O endereco da retirada, campo a campo, como texto. */
export interface AddressDraft {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  reference: string;
}

/** Um banner do carrossel em edicao. */
export interface BannerDraft {
  /**
   * Chave estavel da linha na tela.
   *
   * Nao e o `id` do servidor: banner recem-adicionado ainda nao tem um, e sem
   * uma chave propria o React reaproveitaria o estado da linha errada quando
   * a lista fosse reordenada.
   */
  key: string;
  /** Ausente em banner novo — e a ausencia que faz o servidor criar. */
  id?: string;
  /** `publicId` do Cloudinary. Sem arte o banner nao existe. */
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
  /** Dia local, `YYYY-MM-DD`. Vazio e "desde sempre". */
  startsOn: string;
  /** Dia local. Vazio e "ate segunda ordem"; preenchido, e o ultimo dia no ar. */
  endsOn: string;
  isActive: boolean;
}

/** Uma pagina institucional em edicao. O slug nao se edita. */
export interface PageDraft {
  slug: InstitutionalPageSlug;
  title: string;
  content: string;
  isActive: boolean;
}

export interface SettingsDraft {
  storeName: string;
  /** Como a dona o le: `(88) 99999-9999`. */
  whatsapp: string;
  announcementText: string;
  contactEmail: string;
  businessHours: string;
  pickupEnabled: boolean;
  pickupAddress: AddressDraft;
  pickupInstructions: string;
  instagram: string;
  tiktok: string;
  /** `150,00`. Vazio desliga o minimo geral da loja. */
  freeShippingMin: string;
  banners: BannerDraft[];
  pages: PageDraft[];
}

/* ---- Os erros ---------------------------------------------------------------- */

export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;

export type BannerErrors = Partial<
  Record<'imageDesktop' | 'title' | 'subtitle' | 'buttonLabel' | 'link' | 'window', string>
>;

export type PageErrors = Partial<Record<'title' | 'content', string>>;

export interface SettingsErrors {
  storeName?: string;
  whatsapp?: string;
  announcementText?: string;
  contactEmail?: string;
  businessHours?: string;
  pickupInstructions?: string;
  instagram?: string;
  tiktok?: string;
  freeShippingMin?: string;
  address?: AddressErrors;
  /** Por `key` do rascunho, e nao por `id`: banner novo ainda nao tem `id`. */
  banners?: Record<string, BannerErrors>;
  /** Por `slug`. */
  pages?: Partial<Record<InstitutionalPageSlug, PageErrors>>;
}

/**
 * O que o servidor aceita e provavelmente nao era a intencao.
 *
 * O `scope` diz em que bloco o aviso mora. Nenhum deles bloqueia o
 * salvamento: sao configuracoes legitimas que simplesmente somem do outro
 * lado sem dizer nada.
 */
export interface SettingsWarning {
  scope: 'store' | 'pickup' | 'banners' | 'pages';
  text: string;
}

/* ---- Abrir o rascunho --------------------------------------------------------- */

/** Como cada pagina institucional se chama na tela do painel. */
export const PAGE_LABELS: Record<InstitutionalPageSlug, string> = {
  [INSTITUTIONAL_PAGE_SLUGS.ABOUT]: 'Quem somos',
  [INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY]: 'Como comprar',
  [INSTITUTIONAL_PAGE_SLUGS.RETURNS]: 'Trocas e devoluções',
  [INSTITUTIONAL_PAGE_SLUGS.FAQ]: 'Perguntas frequentes',
  [INSTITUTIONAL_PAGE_SLUGS.PRIVACY]: 'Política de privacidade',
};

export function draftFromSettings(settings: AdminStoreSettings): SettingsDraft {
  return {
    storeName: settings.storeName,
    whatsapp: prettyWhatsapp(settings.whatsappNumber),
    announcementText: settings.announcementText,
    contactEmail: settings.contactEmail,
    businessHours: settings.businessHours,
    pickupEnabled: settings.pickupEnabled,
    pickupAddress: { ...settings.pickupAddress },
    pickupInstructions: settings.pickupInstructions,
    instagram: settings.socialLinks.instagram,
    tiktok: settings.socialLinks.tiktok,
    // `null` e "sem minimo geral", e vira campo vazio — e nao `0,00`, que
    // seria frete gratis em qualquer pedido.
    freeShippingMin:
      settings.freeShippingMinCents === null ? '' : centsToInput(settings.freeShippingMinCents),
    banners: settings.banners.map(draftFromBanner),
    pages: settings.institutionalPages.map(draftFromPage),
  };
}

export function draftFromBanner(banner: AdminBanner): BannerDraft {
  return {
    key: banner.id,
    id: banner.id,
    imageDesktop: banner.imageDesktop,
    imageMobile: banner.imageMobile,
    title: banner.title,
    subtitle: banner.subtitle,
    buttonLabel: banner.buttonLabel,
    link: banner.link,
    startsOn: dateInputValue(banner.startsAt),
    endsOn: dateInputValue(banner.endsAt),
    isActive: banner.isActive,
  };
}

function draftFromPage(page: AdminInstitutionalPage): PageDraft {
  return { slug: page.slug, title: page.title, content: page.content, isActive: page.isActive };
}

/**
 * Um banner novo, ja no ar e sem agendamento.
 *
 * Nasce ligado porque quem acabou de enviar a arte quer ve-la na home — o
 * agendamento e a excecao, e a excecao se configura. O `id` fica **ausente**,
 * e nao `undefined`: com `exactOptionalPropertyTypes`, um campo opcional
 * presente valendo `undefined` nao e a mesma coisa que um campo ausente, e e
 * a ausencia que faz o servidor criar um banner novo.
 */
export function newBanner(imageDesktop: string): BannerDraft {
  return {
    key: `novo-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
    imageDesktop,
    imageMobile: '',
    title: '',
    subtitle: '',
    buttonLabel: '',
    link: '',
    startsOn: '',
    endsOn: '',
    isActive: true,
  };
}

/** Move um banner uma posicao. Fora da lista, devolve a lista como estava. */
export function moveBanner(
  banners: readonly BannerDraft[],
  from: number,
  to: number,
): BannerDraft[] {
  if (from === to || from < 0 || to < 0 || from >= banners.length || to >= banners.length) {
    return [...banners];
  }

  const next = [...banners];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) {
    return [...banners];
  }

  next.splice(to, 0, moved);

  return next;
}

/* ---- O estado de um banner ------------------------------------------------------ */

/**
 * Onde o banner esta, agora.
 *
 * Quatro estados e nao dois, porque um banner desligado e um banner que
 * terminou ontem parecem a mesma coisa na tela e nao sao: o primeiro volta
 * com um clique, o segundo precisa de datas novas. E um banner agendado que
 * nao esta no ar e o caso que mais assusta — "salvei e nao apareceu".
 */
export type BannerStatus = 'live' | 'scheduled' | 'expired' | 'off';

export function bannerStatus(banner: BannerDraft, now: Date): BannerStatus {
  if (!banner.isActive) {
    return 'off';
  }

  const instant = now.getTime();

  if (banner.endsOn !== '' && new Date(dayEndISO(banner.endsOn)).getTime() <= instant) {
    return 'expired';
  }

  if (banner.startsOn !== '' && new Date(dayStartISO(banner.startsOn)).getTime() > instant) {
    return 'scheduled';
  }

  return 'live';
}

export const BANNER_STATUS_LABELS: Record<BannerStatus, string> = {
  live: 'No ar',
  scheduled: 'Agendado',
  expired: 'Encerrado',
  off: 'Desligado',
};

/* ---- O WhatsApp ----------------------------------------------------------------- */

/** Codigo do pais assumido quando o numero vem sem ele. */
const DEFAULT_COUNTRY_CODE = '55';

/** Numero brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/** Pontuacao que a dona cola junto e que o `wa.me` nao aceita. */
const PUNCTUATION = /[\s().+-]/g;

const MIN_WHATSAPP_DIGITS = 12;
const MAX_WHATSAPP_DIGITS = 15;

export const WHATSAPP_MESSAGE =
  'Escreva o número com DDD, como (88) 99999-9999. Ele e o destino de todo pedido da loja.';

/**
 * O numero em formato internacional, ou `null` quando nao e um telefone.
 *
 * Copia de `normalizeWhatsappNumber` do backend. A fidelidade importa por
 * dois motivos: o `wa.me` so aceita digitos — um numero gravado como
 * "(88) 99999-9999" nao da erro no painel, da erro na mao do cliente, na hora
 * de enviar o pedido — e `changesOf` compara o resultado disto com o que o
 * servidor devolveu, entao uma divergencia faria o campo se achar sujo a cada
 * abertura da tela.
 *
 * Vazio e resposta valida: e a loja que ainda nao configurou o numero.
 */
export function normalizeWhatsapp(value: string): string | null {
  const digits = value.trim().replace(PUNCTUATION, '');

  if (digits === '') {
    return '';
  }

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  // O `55` so entra quando o numero tem cara de brasileiro sem o pais: a loja
  // e de Sobral, mas o fornecedor da dona pode nao ser.
  const international = BRAZILIAN_WITHOUT_COUNTRY.test(digits)
    ? `${DEFAULT_COUNTRY_CODE}${digits}`
    : digits;

  return international.length >= MIN_WHATSAPP_DIGITS && international.length <= MAX_WHATSAPP_DIGITS
    ? international
    : null;
}

/**
 * O numero gravado, escrito do jeito que a dona o reconhece.
 *
 * `5588999999999` e o que o `wa.me` precisa e o que ninguem confere olhando.
 * A formatacao acontece ao abrir a tela; `normalizeWhatsapp` a desfaz na
 * saida. Nao e mascara enquanto se digita — reposicionar o cursor a cada
 * tecla e o jeito mais rapido de fazer alguem errar o numero.
 */
export function prettyWhatsapp(number: string): string {
  if (!number.startsWith(DEFAULT_COUNTRY_CODE) || number.length < 12) {
    return number;
  }

  const ddd = number.slice(2, 4);
  const rest = number.slice(4);
  const half = rest.length - 4;

  return `(${ddd}) ${rest.slice(0, half)}-${rest.slice(half)}`;
}

/* ---- A validacao ---------------------------------------------------------------- */

/** Suficiente para pegar erro de digitacao; o servidor valida o resto. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** CEP com ou sem o traco, ou vazio. Mesma expressao do DTO. */
const ZIP_CODE = /^(?:\d{5}-?\d{3})?$/;

/**
 * O que impede as configuracoes de serem salvas.
 *
 * Confere o que o servidor conferiria, e nada alem. Recebe o que esta gravado
 * junto com o rascunho por causa de um caso so: o e-mail de contato, que nao
 * pode ser apagado depois de escrito porque o servidor o valida como e-mail e
 * texto vazio nao passa.
 */
export function validateSettings(
  draft: SettingsDraft,
  settings: AdminStoreSettings,
): SettingsErrors {
  const errors: SettingsErrors = {};

  const name = draft.storeName.trim();

  if (name.length < 2) {
    errors.storeName = 'Escreva o nome da loja.';
  } else if (name.length > SETTINGS_LIMITS.storeName) {
    errors.storeName = `O nome passa de ${String(SETTINGS_LIMITS.storeName)} caracteres.`;
  }

  if (normalizeWhatsapp(draft.whatsapp) === null) {
    errors.whatsapp = WHATSAPP_MESSAGE;
  }

  const email = draft.contactEmail.trim();

  if (email !== '' && !EMAIL.test(email)) {
    errors.contactEmail = 'Escreva um e-mail válido.';
  } else if (email === '' && settings.contactEmail !== '') {
    // O servidor valida o campo como e-mail, e texto vazio nao passa por ali.
    // Melhor dizer isso do que devolver um 400 sem explicacao.
    errors.contactEmail = 'O e-mail não pode ser apagado por aqui — escreva outro no lugar.';
  }

  if (draft.announcementText.length > SETTINGS_LIMITS.announcementText) {
    errors.announcementText = `O aviso passa de ${String(SETTINGS_LIMITS.announcementText)} caracteres.`;
  }

  if (draft.businessHours.length > SETTINGS_LIMITS.businessHours) {
    errors.businessHours = 'Esse texto e longo demais para o rodapé.';
  }

  if (draft.pickupInstructions.length > SETTINGS_LIMITS.pickupInstructions) {
    errors.pickupInstructions = 'Essas instruções são longas demais.';
  }

  for (const rede of ['instagram', 'tiktok'] as const) {
    if (draft[rede].length > SETTINGS_LIMITS.socialLink) {
      errors[rede] = 'Esse endereço e longo demais.';
    }
  }

  if (draft.freeShippingMin.trim() !== '') {
    const free = centsFromInput(draft.freeShippingMin);

    if (free === null || free < 0) {
      errors.freeShippingMin = 'Escreva o valor a partir do qual o frete sai de graça.';
    } else if (free > SETTINGS_LIMITS.freeShippingMinCents) {
      errors.freeShippingMin = 'Esse valor passa do limite do sistema.';
    }
  }

  const address = validateAddress(draft.pickupAddress);

  if (Object.keys(address).length > 0) {
    errors.address = address;
  }

  const banners = validateBanners(draft.banners);

  if (Object.keys(banners).length > 0) {
    errors.banners = banners;
  }

  const pages = validatePages(draft.pages);

  if (Object.keys(pages).length > 0) {
    errors.pages = pages;
  }

  return errors;
}

/**
 * O endereco da retirada.
 *
 * Nenhum campo e obrigatorio, nem com a retirada ligada: o servidor nao os
 * exige, e uma tela que exigisse recusaria o preenchimento em duas sessoes —
 * a dona escreve a rua hoje e o CEP quando encontrar. O que falta vira aviso,
 * e nao erro.
 */
export function validateAddress(address: AddressDraft): AddressErrors {
  const errors: AddressErrors = {};

  const state = address.state.trim();

  if (state !== '' && !/^[A-Za-z]{2}$/.test(state)) {
    errors.state = 'O estado e a sigla de duas letras, como CE.';
  }

  if (!ZIP_CODE.test(address.zipCode.trim())) {
    errors.zipCode = 'O CEP tem o formato 62000-000.';
  }

  const lengths = [
    ['street', SETTINGS_LIMITS.street],
    ['number', SETTINGS_LIMITS.number],
    ['complement', SETTINGS_LIMITS.complement],
    ['district', SETTINGS_LIMITS.district],
    ['city', SETTINGS_LIMITS.city],
    ['reference', SETTINGS_LIMITS.reference],
  ] as const;

  for (const [field, limit] of lengths) {
    if (address[field].length > limit) {
      errors[field] = `Esse texto passa de ${String(limit)} caracteres.`;
    }
  }

  return errors;
}

function validateBanners(banners: readonly BannerDraft[]): Record<string, BannerErrors> {
  const all: Record<string, BannerErrors> = {};

  for (const banner of banners) {
    const errors: BannerErrors = {};

    if (banner.imageDesktop === '') {
      errors.imageDesktop = 'Envie a arte do banner.';
    }

    if (banner.title.length > SETTINGS_LIMITS.bannerTitle) {
      errors.title = 'O título e longo demais para caber na arte.';
    }

    if (banner.subtitle.length > SETTINGS_LIMITS.bannerSubtitle) {
      errors.subtitle = 'A linha de apoio e longa demais.';
    }

    if (banner.buttonLabel.length > SETTINGS_LIMITS.bannerButtonLabel) {
      errors.buttonLabel = 'O texto do botão e longo demais.';
    }

    if (banner.link.length > SETTINGS_LIMITS.bannerLink) {
      errors.link = 'Esse endereço e longo demais.';
    }

    // Um banner que termina antes de comecar nunca apareceria, e a tela
    // mostraria uma campanha salva que ninguem veria.
    if (
      banner.startsOn !== '' &&
      banner.endsOn !== '' &&
      new Date(dayEndISO(banner.endsOn)).getTime() <=
        new Date(dayStartISO(banner.startsOn)).getTime()
    ) {
      errors.window = 'O último dia vem antes do primeiro.';
    }

    if (Object.keys(errors).length > 0) {
      all[banner.key] = errors;
    }
  }

  return all;
}

function validatePages(
  pages: readonly PageDraft[],
): Partial<Record<InstitutionalPageSlug, PageErrors>> {
  const all: Partial<Record<InstitutionalPageSlug, PageErrors>> = {};

  for (const page of pages) {
    const errors: PageErrors = {};
    const title = page.title.trim();

    if (title.length < 2) {
      errors.title = 'Escreva o título da página.';
    } else if (title.length > SETTINGS_LIMITS.pageTitle) {
      errors.title = 'O título e longo demais.';
    }

    if (page.content.length > SETTINGS_LIMITS.pageContent) {
      errors.content = 'O texto passa do tamanho que o sistema guarda.';
    }

    if (Object.keys(errors).length > 0) {
      all[page.slug] = errors;
    }
  }

  return all;
}

export function hasSettingsErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * O que o servidor aceita e que some do site sem avisar.
 *
 * O primeiro deles e o mais caro de todos: sem numero de WhatsApp, o pedido
 * fechado no checkout nao tem para onde ir, e a loja descobre isso pela venda
 * que nao chegou.
 */
export function warningsOf(draft: SettingsDraft): SettingsWarning[] {
  const warnings: SettingsWarning[] = [];

  if (draft.whatsapp.trim() === '') {
    warnings.push({
      scope: 'store',
      text: 'Sem número de WhatsApp, o pedido fechado no site não tem para onde ser enviado.',
    });
  }

  if (draft.pickupEnabled && draft.pickupAddress.street.trim() === '') {
    warnings.push({
      scope: 'pickup',
      text: 'A retirada esta ligada e sem endereço: a cliente escolhe retirar e não vê onde.',
    });
  }

  const semArte = draft.banners.filter((banner) => banner.imageMobile === '').length;

  if (semArte > 0) {
    warnings.push({
      scope: 'banners',
      text:
        semArte === 1
          ? 'Um banner não tem arte de celular e vai usar a de computador, que costuma cortar mal no retrato.'
          : `${String(semArte)} banners não tem arte de celular e vao usar a de computador, que costuma cortar mal no retrato.`,
    });
  }

  const vazias = draft.pages.filter((page) => page.isActive && page.content.trim() === '');

  if (vazias.length > 0) {
    warnings.push({
      scope: 'pages',
      text: `${vazias.map((page) => PAGE_LABELS[page.slug]).join(', ')}: publicada sem texto, o link do rodapé abre uma página em branco.`,
    });
  }

  return warnings;
}

/* ---- O diff --------------------------------------------------------------------- */

/**
 * So o que mudou em relacao ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou. A comparacao acontece contra o rascunho
 * que sairia do documento agora, e nao contra o documento — ver a nota sobre
 * a data do banner no topo do arquivo.
 */
export function changesOf(
  draft: SettingsDraft,
  settings: AdminStoreSettings,
): UpdateStoreSettingsInput | null {
  const base = draftFromSettings(settings);
  const changes: UpdateStoreSettingsInput = {};

  if (draft.storeName.trim() !== base.storeName.trim()) {
    changes.storeName = draft.storeName.trim();
  }

  const whatsapp = normalizeWhatsapp(draft.whatsapp);

  if (whatsapp !== null && whatsapp !== settings.whatsappNumber) {
    changes.whatsappNumber = whatsapp;
  }

  if (draft.announcementText !== base.announcementText) {
    changes.announcementText = draft.announcementText;
  }

  const email = draft.contactEmail.trim();

  // Vazio nunca viaja: o servidor recusaria, e a validacao ja explicou.
  if (email !== '' && email !== settings.contactEmail) {
    changes.contactEmail = email;
  }

  if (draft.businessHours !== base.businessHours) {
    changes.businessHours = draft.businessHours;
  }

  if (draft.pickupEnabled !== base.pickupEnabled) {
    changes.pickupEnabled = draft.pickupEnabled;
  }

  if (draft.pickupInstructions !== base.pickupInstructions) {
    changes.pickupInstructions = draft.pickupInstructions;
  }

  const address = addressChanges(draft.pickupAddress, base.pickupAddress);

  if (address !== null) {
    changes.pickupAddress = address;
  }

  const social: Partial<{ instagram: string; tiktok: string }> = {};

  if (draft.instagram.trim() !== base.instagram.trim()) {
    social.instagram = draft.instagram.trim();
  }

  if (draft.tiktok.trim() !== base.tiktok.trim()) {
    social.tiktok = draft.tiktok.trim();
  }

  if (Object.keys(social).length > 0) {
    changes.socialLinks = social;
  }

  const free = freeShippingOf(draft);

  if (free !== settings.freeShippingMinCents) {
    changes.freeShippingMinCents = free;
  }

  // O carrossel vai inteiro ou nao vai: o array substitui o gravado, e o que
  // sumiu dele foi removido de proposito.
  if (!sameBanners(draft.banners, base.banners)) {
    changes.banners = draft.banners.map(bannerToInput);
  }

  const pages = draft.pages
    .filter((page, index) => !samePage(page, base.pages[index]))
    .map(pageToInput);

  if (pages.length > 0) {
    changes.institutionalPages = pages;
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/**
 * Ha algo pendente na tela.
 *
 * Nao e o mesmo que ter mudancas: um numero de WhatsApp escrito errado nao
 * vira mudanca nenhuma — nao ha o que mandar —, e sem isto a dona digitaria
 * um numero invalido e a tela nao reagiria de jeito nenhum.
 */
export function isDirty(draft: SettingsDraft, settings: AdminStoreSettings): boolean {
  return (
    changesOf(draft, settings) !== null || hasSettingsErrors(validateSettings(draft, settings))
  );
}

function addressChanges(
  draft: AddressDraft,
  base: AddressDraft,
): Partial<AdminPickupAddress> | null {
  const changes: Partial<AdminPickupAddress> = {};
  const fields = Object.keys(draft) as (keyof AddressDraft)[];

  for (const field of fields) {
    // A sigla do estado e comparada em maiuscula porque e assim que o
    // servidor a grava: sem isso, escrever "ce" reenviaria o campo para
    // sempre.
    const value = field === 'state' ? draft[field].trim().toUpperCase() : draft[field].trim();

    if (value !== base[field].trim()) {
      changes[field] = value;
    }
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/** `null` desliga o minimo geral: cada cidade responde pela sua regra. */
function freeShippingOf(draft: SettingsDraft): number | null {
  return draft.freeShippingMin.trim() === '' ? null : centsFromInput(draft.freeShippingMin);
}

function sameBanners(draft: readonly BannerDraft[], base: readonly BannerDraft[]): boolean {
  return (
    draft.length === base.length && draft.every((banner, index) => sameBanner(banner, base[index]))
  );
}

function sameBanner(banner: BannerDraft, other: BannerDraft | undefined): boolean {
  if (other === undefined) {
    return false;
  }

  return (
    banner.id === other.id &&
    banner.imageDesktop === other.imageDesktop &&
    banner.imageMobile === other.imageMobile &&
    banner.title === other.title &&
    banner.subtitle === other.subtitle &&
    banner.buttonLabel === other.buttonLabel &&
    banner.link === other.link &&
    banner.startsOn === other.startsOn &&
    banner.endsOn === other.endsOn &&
    banner.isActive === other.isActive
  );
}

function samePage(page: PageDraft, other: PageDraft | undefined): boolean {
  if (other === undefined) {
    return false;
  }

  return (
    page.title === other.title && page.content === other.content && page.isActive === other.isActive
  );
}

/**
 * Um banner do rascunho, no formato do `PATCH`.
 *
 * `order` sai da posicao no array, que e a ordem que a dona arrastou. As
 * datas viram instantes: o primeiro dia comeca a zero hora, e o ultimo dia
 * termina no fim dele — "ate 25/12" precisa incluir o dia 25 inteiro.
 */
export function bannerToInput(banner: BannerDraft, index: number): BannerInput {
  return {
    ...(banner.id === undefined ? {} : { id: banner.id }),
    imageDesktop: banner.imageDesktop,
    imageMobile: banner.imageMobile,
    title: banner.title.trim(),
    subtitle: banner.subtitle.trim(),
    buttonLabel: banner.buttonLabel.trim(),
    link: banner.link.trim(),
    order: index,
    startsAt: banner.startsOn === '' ? null : dayStartISO(banner.startsOn),
    endsAt: banner.endsOn === '' ? null : dayEndISO(banner.endsOn),
    isActive: banner.isActive,
  };
}

function pageToInput(page: PageDraft): InstitutionalPageInput {
  return {
    slug: page.slug,
    title: page.title.trim(),
    content: page.content,
    isActive: page.isActive,
  };
}
