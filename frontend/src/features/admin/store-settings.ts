import { ROUTES } from '@/app/routes';
import { INSTITUTIONAL_PAGE_SLUGS, type InstitutionalPageSlug } from '@/features/settings';
import { centsFromInput, centsToInput, dateInputValue, dayEndISO, dayStartISO } from '@/lib/format';
import {
  SETTINGS_LIMITS,
  type AdminBanner,
  type AdminPoster,
  type AdminShortcut,
  type AdminGift,
  type AdminInstitutionalPage,
  type AdminPickupAddress,
  type AdminStoreSettings,
  type BannerInput,
  type BannerPlacement,
  type InstitutionalPageInput,
  type PosterInput,
  type ShortcutInput,
  type UpdateStoreSettingsInput,
} from './admin.types';

/**
 * As configurações da loja, enquanto estão sendo editadas.
 *
 * ## Uma tela, cinco assuntos, um rascunho só
 *
 * Nome da loja, retirada, redes, carrossel e páginas são coisas diferentes,
 * mas moram no mesmo documento e são gravadas pelo mesmo `PATCH`. Um rascunho
 * único e o que permite uma barra de salvar só — e a dona que entrou para
 * trocar o texto da barra de avisos e acabou corrigindo o CEP não precisa
 * descobrir que são dois botões diferentes.
 *
 * ## Por que a comparação acontece no espaço do rascunho
 *
 * `changesOf` compara o rascunho com **outro rascunho** — o que sairia de
 * `draftFromSettings` agora —, e não com o documento do servidor. A razão e a
 * data do banner: o servidor guarda um instante, a tela mostra um dia, e a
 * volta do dia para o instante não devolve exatamente o que estava lá. Se a
 * comparação acontecesse no espaço do servidor, toda abertura da tela acharia
 * que os banners mudaram, e a barra de salvar apareceria sozinha.
 *
 * ## Três significados de vazio, de novo
 *
 * - **barra de avisos vazia** tira a barra do ar. E o jeito de desliga-lá;
 * - **frete grátis vazio** e `null`: a loja não tem mínimo geral, e cada
 *   cidade responde pela sua regra;
 * - **e-mail de contato vazio** não pode ser enviado. O servidor valida o
 *   campo como e-mail e recusa o texto vazio, então apagar um e-mail já
 *   gravado e uma coisa que o painel não consegue fazer — e dizer isso e
 *   melhor do que devolver um 400 sem explicação.
 */

/* ---- O rascunho ------------------------------------------------------------- */

/** O endereço da retirada, campo a campo, como texto. */
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

/** Um banner do carrossel em edição. */
export interface BannerDraft {
  /**
   * Chave estável da linha na tela.
   *
   * Não e o `id` do servidor: banner recém-adicionado ainda não tem um, e sem
   * uma chave própria o React reaproveitaria o estado da linha errada quando
   * a lista fosse reordenada.
   */
  key: string;
  /** Ausente em banner novo — e a ausência que faz o servidor criar. */
  id?: string;
  /** `publicId` do Cloudinary. Sem arte o banner não existe. */
  imageDesktop: string;
  imageMobile: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  link: string;
  /** A vaga da home: topo do carrossel ou faixa do meio da página. */
  placement: BannerPlacement;
  /** Dia local, `YYYY-MM-DD`. Vazio e "desde sempre". */
  startsOn: string;
  /** Dia local. Vazio e "até segunda ordem"; preenchido, e o último dia no ar. */
  endsOn: string;
  isActive: boolean;
}

/**
 * Um atalho da fileira da home em edição.
 *
 * O destino não e guardado como caminho aqui, e sim como a escolha que a dona
 * fez: "uma categoria", "uma marca", "uma lista pronta da loja" ou "um
 * endereço escrito". O caminho — `/categorias/hidratantes` — e montado na
 * saída, por `shortcutToInput`. A diferença e o que permite a tela oferecer um
 * seletor de categorias em vez de um campo onde se digita barra e slug na mão,
 * que e o jeito mais rápido de a fileira apontar para uma página que não
 * existe.
 */
export interface ShortcutDraft {
  /**
   * Chave estável da linha na tela.
   *
   * Não e o `id` do servidor: atalho recém-adicionado ainda não tem um, e sem
   * uma chave própria o React reaproveitaria o estado da linha errada quando
   * a fileira fosse reordenada.
   */
  key: string;
  /** Ausente em atalho novo — e a ausência que faz o servidor criar. */
  id?: string;
  label: string;
  /** `publicId` do Cloudinary. Vazio deixa o círculo na inicial do nome. */
  image: string;
  /** Que tipo de destino a dona escolheu. */
  targetKind: LinkTargetKind;
  /** O slug da categoria, o nome da marca, a lista pronta ou o caminho escrito. */
  targetValue: string;
  isActive: boolean;
}

/**
 * Um cartaz da faixa do meio da home em edição.
 *
 * O destino e guardado como a escolha da dona, e não como caminho, pela mesma
 * razão do atalho — e pelo mesmo vocabulário, `LINK_TARGET_KINDS`.
 *
 * A diferença de forma e a arte: aqui ela e exigida. Não e o servidor sendo
 * mais rígido, e o desenho da home — círculo sem foto cai na inicial do nome
 * e continua um atalho, cartaz sem arte e meia tela de retângulo cinza no
 * meio da vitrine.
 */
export interface PosterDraft {
  /**
   * Chave estável da linha na tela.
   *
   * Não e o `id` do servidor, pelo mesmo motivo do atalho: cartaz
   * recém-adicionado ainda não tem um.
   */
  key: string;
  /** Ausente em cartaz novo — e a ausência que faz o servidor criar. */
  id?: string;
  label: string;
  /** `publicId` do Cloudinary. Vazio e cartaz que a validação recusa. */
  image: string;
  /** Que tipo de destino a dona escolheu. */
  targetKind: LinkTargetKind;
  /** O slug da categoria, o nome da marca, a lista pronta ou o caminho escrito. */
  targetValue: string;
  /** A linha de apoio embaixo do nome. Vazia some do cartaz. */
  caption: string;
  isActive: boolean;
}

/**
 * O brinde por valor de compra, em edição.
 *
 * O valor meta e texto — `179,99` —, como todo dinheiro nesta tela: a dona
 * digita vírgula, e o campo vazio e "ainda não escolhi", não `0,00`, que
 * seria brinde em qualquer pedido.
 */
export interface GiftDraft {
  isActive: boolean;
  /** `179,99`. Vazio e "sem valor meta", e o brinde não aparece na loja. */
  minValue: string;
  /** O produto que a cliente ganha. `null` deixa o balão sem foto. */
  productId: string | null;
  /** A frase que completa "Compre R$ 179,99 e ganhe ___". */
  label: string;
}

/** Uma página institucional em edição. O slug não se edita. */
export interface PageDraft {
  slug: InstitutionalPageSlug;
  title: string;
  content: string;
  isActive: boolean;
}

export interface SettingsDraft {
  storeName: string;
  /** Como a dona o lê: `(88) 99999-9999`. */
  whatsapp: string;
  announcementText: string;
  contactEmail: string;
  businessHours: string;
  pickupEnabled: boolean;
  pickupAddress: AddressDraft;
  pickupInstructions: string;
  instagram: string;
  tiktok: string;
  /** `150,00`. Vazio desliga o mínimo geral da loja. */
  freeShippingMin: string;
  /**
   * O produto do "perfume da vez" da home. `null` e "não escolhi", e a seção
   * volta a mostrar o último destaque marcado.
   *
   * Guarda o id, e não o produto: o nome e a foto que a tela exibe saem de
   * uma consulta por id, e o rascunho não precisa envelhecer com eles.
   */
  featuredPerfumeProductId: string | null;
  /**
   * A fileira "Mais vendidos" da home, na ordem dos cards.
   *
   * Só os ids, como o perfume da vez: o nome e a foto de cada linha saem de
   * uma consulta por id, e o rascunho não precisa envelhecer com eles. Lista
   * vazia devolve a fileira ao ranking das vendas.
   */
  bestSellerProductIds: string[];
  gift: GiftDraft;
  banners: BannerDraft[];
  /** A fileira de círculos da home. Vazia, a home cai nas categorias-raiz. */
  shortcuts: ShortcutDraft[];
  /** A faixa do meio da home. Vazia, a faixa cai nas duas categorias maiores. */
  posters: PosterDraft[];
  /**
   * Os nomes da faixa "Nossas marcas", na ordem dela.
   *
   * Só os nomes, como os mais vendidos guardam só os ids: a contagem de cada
   * grafia sai de uma consulta ao catálogo, e o rascunho não precisa
   * envelhecer com ela. Lista vazia devolve a faixa ao automático.
   */
  brands: string[];
  pages: PageDraft[];
}

/* ---- Os erros ---------------------------------------------------------------- */

export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;

export type BannerErrors = Partial<
  Record<'imageDesktop' | 'title' | 'subtitle' | 'buttonLabel' | 'link' | 'window', string>
>;

export type ShortcutErrors = Partial<Record<'label' | 'target', string>>;

/** A arte entra aqui, e não entra na do atalho: cartaz sem arte e recusado. */
export type PosterErrors = Partial<Record<'label' | 'image' | 'target' | 'caption', string>>;

export type PageErrors = Partial<Record<'title' | 'content', string>>;

export type GiftErrors = Partial<Record<'minValue' | 'label', string>>;

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
  gift?: GiftErrors;
  address?: AddressErrors;
  /** Por `key` do rascunho, e não por `id`: banner novo ainda não tem `id`. */
  banners?: Record<string, BannerErrors>;
  /** Por `key` do rascunho, pelo mesmo motivo dos banners. */
  shortcuts?: Record<string, ShortcutErrors>;
  /** Por `key` do rascunho, pelo mesmo motivo dos banners. */
  posters?: Record<string, PosterErrors>;
  /** Por `slug`. */
  pages?: Partial<Record<InstitutionalPageSlug, PageErrors>>;
}

/**
 * O que o servidor aceita e provavelmente não era a intenção.
 *
 * O `scope` diz em que bloco o aviso mora. Nenhum deles bloqueia o
 * salvamento: são configurações legitimas que simplesmente somem do outro
 * lado sem dizer nada.
 */
export interface SettingsWarning {
  scope: 'store' | 'pickup' | 'gift' | 'banners' | 'shortcuts' | 'posters' | 'brands' | 'pages';
  text: string;
}

/* ---- Abrir o rascunho --------------------------------------------------------- */

/** Como cada página institucional se chama na tela do painel. */
export const PAGE_LABELS: Record<InstitutionalPageSlug, string> = {
  [INSTITUTIONAL_PAGE_SLUGS.ABOUT]: 'Quem somos',
  [INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY]: 'Como comprar',
  [INSTITUTIONAL_PAGE_SLUGS.USAGE]: 'Modo de uso',
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
    // `null` e "sem mínimo geral", e vira campo vazio — e não `0,00`, que
    // seria frete grátis em qualquer pedido.
    freeShippingMin:
      settings.freeShippingMinCents === null ? '' : centsToInput(settings.freeShippingMinCents),
    featuredPerfumeProductId: settings.featuredPerfumeProductId,
    bestSellerProductIds: [...settings.bestSellerProductIds],
    gift: draftFromGift(settings.gift),
    banners: settings.banners.map(draftFromBanner),
    shortcuts: settings.shortcuts.map(draftFromShortcut),
    posters: settings.posters.map(draftFromPoster),
    brands: [...settings.brands],
    pages: settings.institutionalPages.map(draftFromPage),
  };
}

function draftFromGift(gift: AdminGift): GiftDraft {
  return {
    isActive: gift.isActive,
    // `null` vira campo vazio, e não `0,00`: zero seria brinde em qualquer
    // pedido, inclusive num de cinco reais.
    minValue: gift.minCents === null ? '' : centsToInput(gift.minCents),
    productId: gift.productId,
    label: gift.label,
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
    placement: banner.placement,
    startsOn: dateInputValue(banner.startsAt),
    endsOn: dateInputValue(banner.endsAt),
    isActive: banner.isActive,
  };
}

function draftFromPage(page: AdminInstitutionalPage): PageDraft {
  return { slug: page.slug, title: page.title, content: page.content, isActive: page.isActive };
}

/**
 * Um banner novo, já no ar e sem agendamento.
 *
 * Nasce ligado porque quem acabou de enviar a arte quer vê-lá na home — o
 * agendamento e a exceção, e a exceção se configura. O `id` fica **ausente**,
 * e não `undefined`: com `exactOptionalPropertyTypes`, um campo opcional
 * presente valendo `undefined` não e a mesma coisa que um campo ausente, e e
 * a ausência que faz o servidor criar um banner novo.
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
    // Nasce no topo: e a vaga que toda loja usa, e a do meio e a escolha
    // deliberada de quem já tem uma campanha para pôr lá.
    placement: 'hero',
    startsOn: '',
    endsOn: '',
    isActive: true,
  };
}

/** Move um banner uma posição. Fora da lista, devolve a lista como estava. */
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
 * Quatro estados e não dois, porque um banner desligado e um banner que
 * terminou ontem parecem a mesma coisa na tela e não são: o primeiro volta
 * com um clique, o segundo precisa de datas novas. E um banner agendado que
 * não esta no ar e o caso que mais assusta — "salvei e não apareceu".
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

/* ---- O destino de um atalho ou de um cartaz --------------------------------------- */

/**
 * As quatro formas de responder "para onde isto leva".
 *
 * `LINK_` e não `SHORTCUT_`: a mesma pergunta e feita duas vezes na tela de
 * Ajustes — pela fileira de círculos e pela faixa de cartazes —, e as duas
 * gravam a mesma coisa, um caminho. O que difere entre elas e o desenho na
 * home, não o destino.
 *
 * O servidor guarda um caminho — `/categorias/hidratantes` — e só. A escolha
 * em quatro formas mora aqui, na tela, e por um motivo prático: pedir a
 * categoria num seletor e pedir a marca num campo de texto e o que impede a
 * fileira de apontar para uma página que não existe, que e o que acontece
 * quando alguém digita barra e slug na mão. Na saída as quatro viram o mesmo
 * caminho, e no servidor nenhuma delas tem nome.
 *
 * `custom` não e sobra: e a válvula que faz este modelo não precisar crescer
 * toda vez que a loja inventar um destino novo.
 */
export const LINK_TARGET_KINDS = ['category', 'brand', 'route', 'custom'] as const;

export type LinkTargetKind = (typeof LINK_TARGET_KINDS)[number];

export const LINK_TARGET_LABELS: Record<LinkTargetKind, string> = {
  category: 'Uma categoria',
  brand: 'Uma marca',
  route: 'Uma lista da loja',
  custom: 'Um endereço escrito',
};

/**
 * As listas prontas da loja, com o nome que a dona reconhece.
 *
 * São rotas que existem e que nenhuma categoria representa: "mais vendidos"
 * sai do histórico de pedidos, "promoções" sai do preço, "pronta entrega" sai
 * da marcação de cada frasco. Antes desta lista, pôr qualquer uma das três na
 * primeira tela exigia inventar uma categoria vazia para ela.
 */
export const LINK_ROUTES = [
  { value: ROUTES.products, label: 'Todos os produtos' },
  { value: ROUTES.bestSellers, label: 'Mais vendidos' },
  { value: ROUTES.readyToShip, label: 'Pronta entrega' },
  { value: ROUTES.productsOnSale, label: 'Promoções' },
] as const;

/** O prefixo da vitrine filtrada por marca, para ler o caminho de volta. */
const BRAND_PREFIX = `${ROUTES.products}?marca=`;

/** O prefixo da categoria, para ler o caminho de volta. */
const CATEGORY_PREFIX = ROUTES.category('');

/**
 * O caminho que este destino vira.
 *
 * Destino sem valor devolve texto vazio, e não um caminho pela metade:
 * `/categorias/` levaria a lugar nenhum, e um atalho sem destino e recusado
 * pela validação antes de chegar aqui.
 */
export function linkFromTarget(kind: LinkTargetKind, value: string): string {
  const written = value.trim();

  if (written === '') {
    return '';
  }

  switch (kind) {
    case 'category':
      return ROUTES.category(written);
    case 'brand':
      return ROUTES.productsByBrand(written);
    case 'route':
    case 'custom':
      return written;
  }
}

/**
 * O caminho gravado, de volta na escolha que o produziu.
 *
 * A leitura e **estrita**: `/produtos?marca=Lattafa` e a marca Lattafa, mas
 * `/produtos?marca=Lattafa&pagina=2` e um endereço escrito. Reconhecer o
 * segundo como marca faria o salvamento seguinte reescrever o caminho sem o
 * `&pagina=2` — a tela apagaria em silêncio uma parte do destino que alguém
 * montou de propósito.
 */
export function targetFromLink(link: string): { kind: LinkTargetKind; value: string } {
  const written = link.trim();

  if (LINK_ROUTES.some((route) => route.value === written)) {
    return { kind: 'route', value: written };
  }

  if (written.startsWith(CATEGORY_PREFIX)) {
    const slug = written.slice(CATEGORY_PREFIX.length);

    if (slug !== '' && !slug.includes('/') && !slug.includes('?')) {
      return { kind: 'category', value: slug };
    }
  }

  if (written.startsWith(BRAND_PREFIX)) {
    const brand = written.slice(BRAND_PREFIX.length);

    if (brand !== '' && !brand.includes('&')) {
      return { kind: 'brand', value: decodeURIComponent(brand) };
    }
  }

  return { kind: 'custom', value: written };
}

/* ---- Os atalhos da home ---------------------------------------------------------- */

export function draftFromShortcut(shortcut: AdminShortcut): ShortcutDraft {
  const target = targetFromLink(shortcut.link);

  return {
    key: shortcut.id,
    id: shortcut.id,
    label: shortcut.label,
    image: shortcut.image,
    targetKind: target.kind,
    targetValue: target.value,
    isActive: shortcut.isActive,
  };
}

/**
 * Um atalho novo, ligado e sem destino.
 *
 * Nasce vazio e não a partir de um envio de foto, ao contrário do banner: o
 * círculo sem foto existe há tempos — ele cai na inicial do nome —, e exigir
 * a imagem primeiro obrigaria a dona a ter a arte pronta antes de montar a
 * fileira. O que ele não pode e nascer com destino: "Todos os produtos" como
 * padrão daria uma fileira de círculos que levam todos ao mesmo lugar, e
 * ninguém repara nisso olhando a tela.
 *
 * O `id` fica **ausente**, e não `undefined`: com `exactOptionalPropertyTypes`,
 * um campo opcional presente valendo `undefined` não e a mesma coisa que um
 * campo ausente, e e a ausência que faz o servidor criar.
 */
export function newShortcut(): ShortcutDraft {
  return {
    key: `novo-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    image: '',
    targetKind: 'category',
    targetValue: '',
    isActive: true,
  };
}

/** Move um atalho uma posição. Fora da lista, devolve a lista como estava. */
export function moveShortcut(
  shortcuts: readonly ShortcutDraft[],
  from: number,
  to: number,
): ShortcutDraft[] {
  return moveItem(shortcuts, from, to);
}

/**
 * Tira de uma posição e põe noutra, devolvendo uma lista nova.
 *
 * Genérica porque são duas listas ordenáveis com a mesma mecânica — os
 * atalhos da home e os mais vendidos — e a aritmética de índice fora de faixa
 * não merece duas implementações. Índice inválido devolve a lista como estava:
 * "subir" na primeira linha não e erro, e não faz nada.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) {
    return [...items];
  }

  next.splice(to, 0, moved);

  return next;
}

/**
 * Um atalho do rascunho, no formato do `PATCH`.
 *
 * `order` sai da posição no array, que e a ordem que a dona arrastou, e o
 * destino vira o caminho que o servidor guarda.
 */
export function shortcutToInput(shortcut: ShortcutDraft, index: number): ShortcutInput {
  return {
    ...(shortcut.id === undefined ? {} : { id: shortcut.id }),
    label: shortcut.label.trim(),
    image: shortcut.image,
    link: linkFromTarget(shortcut.targetKind, shortcut.targetValue),
    order: index,
    isActive: shortcut.isActive,
  };
}

/* ---- Os cartazes de coleção -------------------------------------------------------- */

export function draftFromPoster(poster: AdminPoster): PosterDraft {
  const target = targetFromLink(poster.link);

  return {
    key: poster.id,
    id: poster.id,
    label: poster.label,
    image: poster.image,
    targetKind: target.kind,
    targetValue: target.value,
    caption: poster.caption,
    isActive: poster.isActive,
  };
}

/**
 * Um cartaz novo, a partir da arte que acabou de subir.
 *
 * Nasce da arte e não vazio, ao contrário do atalho: sem ela não há cartaz
 * nenhum — a home se recusa a desenhar meia tela de retângulo cinza —, e um
 * cartaz vazio na lista seria uma linha que só sabe dizer o que falta.
 *
 * O `id` fica **ausente**, e não `undefined`: com `exactOptionalPropertyTypes`,
 * um campo opcional presente valendo `undefined` não e a mesma coisa que um
 * campo ausente, e e a ausência que faz o servidor criar.
 */
export function newPoster(image: string): PosterDraft {
  return {
    key: `novo-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    image,
    targetKind: 'category',
    targetValue: '',
    caption: '',
    isActive: true,
  };
}

/** Move um cartaz uma posição. Fora da lista, devolve a lista como estava. */
export function movePoster(posters: readonly PosterDraft[], from: number, to: number): PosterDraft[] {
  return moveItem(posters, from, to);
}

/**
 * Um cartaz do rascunho, no formato do `PATCH`.
 *
 * `order` sai da posição no array, que e a ordem da faixa — o primeiro fica a
 * esquerda no computador e em cima no celular.
 */
export function posterToInput(poster: PosterDraft, index: number): PosterInput {
  return {
    ...(poster.id === undefined ? {} : { id: poster.id }),
    label: poster.label.trim(),
    image: poster.image,
    link: linkFromTarget(poster.targetKind, poster.targetValue),
    caption: poster.caption.trim(),
    order: index,
    isActive: poster.isActive,
  };
}

/* ---- A faixa de marcas ------------------------------------------------------------ */

/**
 * A marca reduzida ao que ela tem de comparável.
 *
 * Marca e campo livre do cadastro do produto, e e isso que produz "Árabe" e
 * "ARABE" convivendo na faixa da home como se fossem duas casas. Comparar sem
 * acento, sem caixa e sem espaço dobrado junta as duas.
 *
 * O apóstrofo **some** em vez de virar espaço, e isso e deliberado:
 * "Victoria's Secret" e "Victorias Secret" são a mesma casa, e separa-las por
 * causa de um sinal de pontuação seria o detector reproduzindo exatamente o
 * erro que ele existe para achar.
 *
 * A normalização e **só para comparar**: o que se grava e a grafia escolhida,
 * porque e ela que o filtro `?marca=` precisa casar no cadastro.
 */
export function brandKey(name: string): string {
  return name
    .normalize('NFD')
    // As marcas combinantes do Unicode: o que sobra de "á" depois do NFD.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019\u02bc`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Quantas letras separam duas grafias, até o teto que interessa.
 *
 * Levenshtein com duas linhas, que e o bastante para nomes de marca: a
 * resposta exata de "quantas edições" não importa — importa saber se e uma.
 */
function editDistance(first: string, second: string): number {
  let previous = [...Array(second.length + 1).keys()];

  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];

    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;

      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }

    previous = current;
  }

  return previous[second.length] ?? 0;
}

/**
 * Duas grafias que são, quase certamente, a mesma marca.
 *
 * Igualdade depois da normalização — "Árabe" e "ARABE" — e **uma letra de
 * diferença**, que e o erro de digitação de verdade: "Isabele La Belle" e
 * "Isabelle La Belle" não são a mesma string nem depois de tirar acento e
 * caixa, e e esse par que aparece na home como duas marcas.
 *
 * Uma letra, e não duas, e só a partir de cinco: em nome curto uma letra
 * costuma ser outra marca, e o aviso que grita onde não há problema deixa de
 * ser lido no dia em que houver.
 */
function nearlySame(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  if (Math.abs(first.length - second.length) > 1 || Math.min(first.length, second.length) < 5) {
    return false;
  }

  return editDistance(first, second) <= 1;
}

/**
 * Os grupos de grafias que parecem a mesma marca.
 *
 * Devolve só os grupos com mais de uma grafia, na ordem em que a primeira de
 * cada grupo apareceu. E o que a tela usa para dizer "estas duas são a mesma
 * marca escrita de dois jeitos" — tanto na faixa montada quanto na lista que
 * sai do catálogo, que e onde o erro nasceu.
 */
export function brandCollisions(names: readonly string[]): string[][] {
  const groups: { key: string; names: string[] }[] = [];

  for (const name of names) {
    const key = brandKey(name);

    if (key === '') {
      continue;
    }

    // Compara com a primeira grafia de cada grupo, e não com todas: e ela que
    // da nome ao grupo, e encadear semelhanças ("a" parece "b", "b" parece
    // "c") acabaria juntando duas marcas que não se parecem em nada.
    const group = groups.find((candidate) => nearlySame(candidate.key, key));

    if (group === undefined) {
      groups.push({ key, names: [name] });
    } else if (!group.names.includes(name)) {
      group.names.push(name);
    }
  }

  return groups.map((group) => group.names).filter((group) => group.length > 1);
}

/* ---- O WhatsApp ----------------------------------------------------------------- */

/** Código do pais assumido quando o número vem sem ele. */
const DEFAULT_COUNTRY_CODE = '55';

/** Número brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/** Pontuação que a dona cola junto e que o `wa.me` não aceita. */
const PUNCTUATION = /[\s().+-]/g;

const MIN_WHATSAPP_DIGITS = 12;
const MAX_WHATSAPP_DIGITS = 15;

export const WHATSAPP_MESSAGE =
  'Escreva o número com DDD, como (88) 99999-9999. Ele e o destino de todo pedido da loja.';

/**
 * O número em formato internacional, ou `null` quando não e um telefone.
 *
 * Copia de `normalizeWhatsappNumber` do backend. A fidelidade importa por
 * dois motivos: o `wa.me` só aceita digitos — um número gravado como
 * "(88) 99999-9999" não da erro no painel, da erro na mão do cliente, na hora
 * de enviar o pedido — e `changesOf` compara o resultado disto com o que o
 * servidor devolveu, então uma divergência faria o campo se achar sujo a cada
 * abertura da tela.
 *
 * Vazio e resposta valida: e a loja que ainda não configurou o número.
 */
export function normalizeWhatsapp(value: string): string | null {
  const digits = value.trim().replace(PUNCTUATION, '');

  if (digits === '') {
    return '';
  }

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  // O `55` só entra quando o número tem cara de brasileiro sem o pais: a loja
  // e de Sobral, mas o fornecedor da dona pode não ser.
  const international = BRAZILIAN_WITHOUT_COUNTRY.test(digits)
    ? `${DEFAULT_COUNTRY_CODE}${digits}`
    : digits;

  return international.length >= MIN_WHATSAPP_DIGITS && international.length <= MAX_WHATSAPP_DIGITS
    ? international
    : null;
}

/**
 * O número gravado, escrito do jeito que a dona o reconhece.
 *
 * `5588999999999` e o que o `wa.me` precisa e o que ninguém confere olhando.
 * A formatação acontece ao abrir a tela; `normalizeWhatsapp` a desfaz na
 * saída. Não e máscara enquanto se digita — reposicionar o cursor a cada
 * tecla e o jeito mais rápido de fazer alguém errar o número.
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

/* ---- A validação ---------------------------------------------------------------- */

/** Suficiente para pegar erro de digitação; o servidor valida o resto. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** CEP com ou sem o traço, ou vazio. Mesma expressão do DTO. */
const ZIP_CODE = /^(?:\d{5}-?\d{3})?$/;

/**
 * O que impede as configurações de serem salvas.
 *
 * Confere o que o servidor conferiria, e nada além. Recebe o que esta gravado
 * junto com o rascunho por causa de um caso só: o e-mail de contato, que não
 * pode ser apagado depois de escrito porque o servidor o valida como e-mail e
 * texto vazio não passa.
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
    // O servidor valida o campo como e-mail, e texto vazio não passa por ali.
    // Melhor dizer isso do que devolver um 400 sem explicação.
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

  const gift = validateGift(draft.gift);

  if (Object.keys(gift).length > 0) {
    errors.gift = gift;
  }

  const address = validateAddress(draft.pickupAddress);

  if (Object.keys(address).length > 0) {
    errors.address = address;
  }

  const banners = validateBanners(draft.banners);

  if (Object.keys(banners).length > 0) {
    errors.banners = banners;
  }

  const shortcuts = validateShortcuts(draft.shortcuts);

  if (Object.keys(shortcuts).length > 0) {
    errors.shortcuts = shortcuts;
  }

  const posters = validatePosters(draft.posters);

  if (Object.keys(posters).length > 0) {
    errors.posters = posters;
  }

  const pages = validatePages(draft.pages);

  if (Object.keys(pages).length > 0) {
    errors.pages = pages;
  }

  return errors;
}

/**
 * O brinde por valor de compra.
 *
 * Dois erros, e os dois são de digitação. O que falta — brinde ligado sem
 * produto, sem frase ou sem valor — não e erro: e configuração pela metade,
 * que o servidor aceita e que vira aviso escrito em `warningsOf`. A diferença
 * importa porque a dona monta a campanha em duas sessões, e uma tela que
 * recusasse o meio do caminho a obrigaria a terminar de uma vez.
 *
 * O zero e a exceção, e por isso e erro: "a partir de R$ 0,00" não desliga o
 * brinde com clareza nenhuma — ele some da loja e o campo continua
 * preenchido, que e o jeito mais rápido de alguém achar que salvou e não
 * salvou.
 */
export function validateGift(gift: GiftDraft): GiftErrors {
  const errors: GiftErrors = {};
  const written = gift.minValue.trim();

  if (written !== '') {
    const cents = centsFromInput(written);

    if (cents === null || cents < 0) {
      errors.minValue = 'Escreva o valor a partir do qual a cliente ganha o brinde.';
    } else if (cents === 0) {
      errors.minValue = 'A partir de zero todo pedido ganharia. Para tirar o brinde, desligue-o.';
    } else if (cents > SETTINGS_LIMITS.giftMinCents) {
      errors.minValue = 'Esse valor passa do limite do sistema.';
    }
  }

  if (gift.label.length > SETTINGS_LIMITS.giftLabel) {
    errors.label = `A frase passa de ${String(SETTINGS_LIMITS.giftLabel)} caracteres e não cabe no balão.`;
  }

  return errors;
}

/**
 * O endereço da retirada.
 *
 * Nenhum campo e obrigatório, nem com a retirada ligada: o servidor não os
 * exige, e uma tela que exigisse recusaria o preenchimento em duas sessões —
 * a dona escreve a rua hoje e o CEP quando encontrar. O que falta vira aviso,
 * e não erro.
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

    // Um banner que termina antes de começar nunca apareceria, e a tela
    // mostraria uma campanha salva que ninguém veria.
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

/**
 * Os atalhos da fileira.
 *
 * Nome e destino são exigidos, e a foto não: círculo sem foto cai na inicial
 * do nome — e uma tela que exigisse a imagem obrigaria a dona a ter a arte
 * pronta antes de montar a fileira. Atalho sem destino, ao contrário, não e
 * configuração pela metade: e um círculo que a cliente toca e nada acontece,
 * e o servidor o recusa de qualquer forma.
 */
export function validateShortcuts(
  shortcuts: readonly ShortcutDraft[],
): Record<string, ShortcutErrors> {
  const all: Record<string, ShortcutErrors> = {};

  for (const shortcut of shortcuts) {
    const errors: ShortcutErrors = {};
    const label = shortcut.label.trim();

    if (label === '') {
      errors.label = 'Escreva o nome que aparece embaixo do círculo.';
    } else if (label.length > SETTINGS_LIMITS.shortcutLabel) {
      errors.label = `O nome passa de ${String(SETTINGS_LIMITS.shortcutLabel)} caracteres e não cabe embaixo do círculo.`;
    }

    const link = linkFromTarget(shortcut.targetKind, shortcut.targetValue);

    if (link === '') {
      errors.target = 'Escolha para onde este atalho leva.';
    } else if (link.length > SETTINGS_LIMITS.shortcutLink) {
      errors.target = 'Esse endereço e longo demais.';
    }

    if (Object.keys(errors).length > 0) {
      all[shortcut.key] = errors;
    }
  }

  return all;
}

/**
 * Os cartazes da faixa.
 *
 * Nome, arte e destino são exigidos, e a linha de apoio não: ela e um
 * complemento — "41 produtos" — e o cartaz sem ela esta inteiro.
 *
 * A arte entra na lista do que se exige, ao contrário do atalho. O círculo
 * sem foto cai na inicial do nome e continua um atalho; o cartaz sem arte e
 * meia tela de retângulo cinza no meio da vitrine, e a home se recusa a
 * desenha-lo — o que deixaria a dona com uma faixa que sumiu sem explicação.
 */
export function validatePosters(posters: readonly PosterDraft[]): Record<string, PosterErrors> {
  const all: Record<string, PosterErrors> = {};

  for (const poster of posters) {
    const errors: PosterErrors = {};
    const label = poster.label.trim();

    if (label === '') {
      errors.label = 'Escreva o nome que aparece sobre a arte.';
    } else if (label.length > SETTINGS_LIMITS.posterLabel) {
      errors.label = `O nome passa de ${String(SETTINGS_LIMITS.posterLabel)} caracteres e não cabe no cartaz.`;
    }

    if (poster.image === '') {
      errors.image = 'Envie a arte: sem ela a home não desenha este cartaz.';
    }

    const link = linkFromTarget(poster.targetKind, poster.targetValue);

    if (link === '') {
      errors.target = 'Escolha para onde este cartaz leva.';
    } else if (link.length > SETTINGS_LIMITS.posterLink) {
      errors.target = 'Esse endereço e longo demais.';
    }

    if (poster.caption.trim().length > SETTINGS_LIMITS.posterCaption) {
      errors.caption = `A linha de apoio passa de ${String(SETTINGS_LIMITS.posterCaption)} caracteres e quebra em duas.`;
    }

    if (Object.keys(errors).length > 0) {
      all[poster.key] = errors;
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
 * O primeiro deles e o mais caro de todos: sem número de WhatsApp, o pedido
 * fechado no checkout não tem para onde ir, e a loja descobre isso pela venda
 * que não chegou.
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

  warnings.push(...giftWarnings(draft.gift));

  const semArte = draft.banners.filter((banner) => banner.imageMobile === '').length;

  if (semArte > 0) {
    warnings.push({
      scope: 'banners',
      text:
        semArte === 1
          ? 'Um banner não tem arte de celular e vai usar a de computador, que costuma cortar mal no retrato.'
          : `${String(semArte)} banners não tem arte de celular e vão usar a de computador, que costuma cortar mal no retrato.`,
    });
  }

  warnings.push(...shortcutWarnings(draft.shortcuts));
  warnings.push(...posterWarnings(draft.posters));
  warnings.push(...brandWarnings(draft.brands));

  const vazias = draft.pages.filter((page) => page.isActive && page.content.trim() === '');

  if (vazias.length > 0) {
    warnings.push({
      scope: 'pages',
      text: `${vazias.map((page) => PAGE_LABELS[page.slug]).join(', ')}: publicada sem texto, o link do rodapé abre uma página em branco.`,
    });
  }

  return warnings;
}

/**
 * A fileira de atalhos que não vai sair como a dona imagina.
 *
 * Nenhum dos dois bloqueia: os dois são estados legítimos que mudam a home
 * sem dizer nada. O primeiro e o mais caro — fileira vazia não deixa a home
 * sem navegação, ela volta as categorias-raiz, e quem salvou achando ter
 * montado a fileira não entende por que a loja mostra outra coisa.
 */
function shortcutWarnings(shortcuts: readonly ShortcutDraft[]): SettingsWarning[] {
  const warnings: SettingsWarning[] = [];
  const ligados = shortcuts.filter((shortcut) => shortcut.isActive);

  if (ligados.length === 0) {
    warnings.push({
      scope: 'shortcuts',
      text:
        shortcuts.length === 0
          ? 'A fileira esta vazia: a home mostra as categorias principais, na ordem de Categorias.'
          : 'Todos os atalhos estão desligados: a home volta a mostrar as categorias principais.',
    });

    return warnings;
  }

  const semFoto = ligados.filter((shortcut) => shortcut.image === '').length;

  if (semFoto > 0) {
    warnings.push({
      scope: 'shortcuts',
      text:
        semFoto === 1
          ? 'Um atalho esta sem foto: o círculo dele aparece com a inicial do nome.'
          : `${String(semFoto)} atalhos estão sem foto: os círculos deles aparecem com a inicial do nome.`,
    });
  }

  if (ligados.length > SETTINGS_LIMITS.shortcuts) {
    warnings.push({
      scope: 'shortcuts',
      text: `A fileira mostra ${String(SETTINGS_LIMITS.shortcuts)} círculos. Os de baixo não aparecem na home.`,
    });
  }

  return warnings;
}

/**
 * A faixa de cartazes que não vai sair como a dona imagina.
 *
 * Dois estados mudam a home de um jeito que ninguém adivinha daqui:
 *
 * - **os cartazes cadastrados, todos desligados**, devolvem a faixa as duas
 *   categorias com mais produtos. A faixa continua lá, com outro conteúdo —
 *   e quem desligou não pediu para ver categoria nenhuma;
 * - **um só ligado** tira a faixa inteira da home, porque o desenho dela são
 *   duas colunas e meia faixa não existe. E o estado que mais assusta: a dona
 *   salva um cartaz e a faixa some.
 *
 * A faixa **vazia** não avisa nada: e o estado inicial de toda loja, e a
 * própria seção já diz, no lugar da lista, que a home esta deduzindo a dupla.
 * Aviso que nasce ligado em instalação nova e aviso que ninguém lê.
 *
 * Nenhum dos dois bloqueia: são estados legítimos de quem esta montando a
 * faixa e ainda não terminou.
 */
function posterWarnings(posters: readonly PosterDraft[]): SettingsWarning[] {
  const ligados = posters.filter((poster) => poster.isActive);

  if (posters.length === 0) {
    return [];
  }

  if (ligados.length === 0) {
    return [
      {
        scope: 'posters',
        text: 'Os cartazes estão desligados: a home volta a mostrar as duas categorias com mais produtos.',
      },
    ];
  }

  if (ligados.length === 1) {
    return [
      {
        scope: 'posters',
        text: 'Só um cartaz ligado: a faixa são duas colunas, e com um só ela não aparece na home. Ligue o segundo, ou desligue os dois para a faixa voltar as categorias.',
      },
    ];
  }

  return [];
}

/**
 * A faixa de marcas que não vai sair como a dona imagina.
 *
 * Dois casos, e os dois são silenciosos do outro lado:
 *
 * - **uma marca só** tira a faixa inteira da home. Uma palavra solta no meio
 *   da página não e uma fileira, e a home prefere não desenhar nada — o que,
 *   de dentro do painel, parece a tela não ter gravado;
 * - **duas grafias da mesma marca** e o erro que a faixa automática tornou
 *   visível: marca e campo livre do cadastro, e "Isabele La Belle" e
 *   "Isabelle La Belle" viram dois nomes na home e duas vitrines, cada uma
 *   com parte dos produtos. Escolher as duas a mão repetiria isso de
 *   propósito.
 *
 * O segundo não bloqueia porque pode ser verdade: duas marcas diferentes
 * podem mesmo ter nomes parecidos. Quem decide e quem conhece o estoque.
 */
function brandWarnings(brands: readonly string[]): SettingsWarning[] {
  if (brands.length === 1) {
    return [
      {
        scope: 'brands',
        text: 'Com uma marca só a faixa não aparece na home — uma palavra solta no meio da página não e uma fileira. Escolha pelo menos duas, ou nenhuma para a faixa voltar ao automático.',
      },
    ];
  }

  return brandCollisions(brands).map((group) => {
    const escritas = group.map((name) => `“${name}”`).join(' e ');

    return {
      scope: 'brands',
      text: `${escritas} estão na faixa como marcas diferentes. Se são a mesma, cada vitrine mostra só parte dos produtos — e o que corrige isso e a grafia no cadastro deles.`,
    };
  });
}

/**
 * O brinde ligado que a loja não vai mostrar.
 *
 * E o aviso mais caro desta tela, porque ele e silencioso dos dois lados: a
 * dona liga o brinde, salva, e nada acontece na loja — nem erro, nem balão. O
 * servidor aceitou tudo; o que falta e o que a campanha precisa para ser uma
 * promessa (ver `gift.ts`, no backend).
 *
 * Brinde desligado não avisa nada: desligado e um estado legitimo, e um aviso
 * ali seria a tela cobrando uma campanha que ninguém pediu.
 */
function giftWarnings(gift: GiftDraft): SettingsWarning[] {
  if (!gift.isActive) {
    return [];
  }

  const warnings: SettingsWarning[] = [];

  if (gift.minValue.trim() === '') {
    warnings.push({
      scope: 'gift',
      text: 'O brinde esta ligado e sem valor meta: enquanto não houver um valor, o balão não aparece na loja.',
    });
  }

  if (gift.productId === null && gift.label.trim() === '') {
    warnings.push({
      scope: 'gift',
      text: 'O brinde esta ligado e não tem produto nem frase: não há o que anunciar, e o balão não aparece.',
    });
  } else if (gift.productId === null) {
    warnings.push({
      scope: 'gift',
      text: 'Sem produto escolhido, o balão aparece só com a frase — e e a foto do brinde que faz a cliente parar para ler.',
    });
  }

  return warnings;
}

/* ---- O diff --------------------------------------------------------------------- */

/**
 * Só o que mudou em relação ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou. A comparação acontece contra o rascunho
 * que sairia do documento agora, e não contra o documento — ver a nota sobre
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

  // Vazio nunca viaja: o servidor recusaria, e a validação já explicou.
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

  // `null` viaja: e ele que devolve o perfume da vez ao último destaque, e
  // omitir o campo deixaria a escolha antiga gravada para sempre.
  if (draft.featuredPerfumeProductId !== base.featuredPerfumeProductId) {
    changes.featuredPerfumeProductId = draft.featuredPerfumeProductId;
  }

  const gift = giftChanges(draft.gift, base.gift);

  if (gift !== null) {
    changes.gift = gift;
  }

  // O carrossel vai inteiro ou não vai: o array substitui o gravado, e o que
  // sumiu dele foi removido de propósito.
  if (!sameBanners(draft.banners, base.banners)) {
    changes.banners = draft.banners.map(bannerToInput);
  }

  // A fileira vai inteira ou não vai, como o carrossel: o array substitui o
  // gravado, e o atalho que sumiu dele foi removido de propósito.
  if (!sameShortcuts(draft.shortcuts, base.shortcuts)) {
    changes.shortcuts = draft.shortcuts.map(shortcutToInput);
  }

  // A faixa vai inteira, pelo mesmo motivo da fileira.
  if (!samePosters(draft.posters, base.posters)) {
    changes.posters = draft.posters.map(posterToInput);
  }

  // As marcas vao inteiras, e a lista vazia viaja: e ela que devolve a faixa
  // as marcas dos produtos que a home carregou. A ordem faz parte do que
  // mudou, como nos mais vendidos.
  if (!sameOrder(draft.brands, base.brands)) {
    changes.brands = [...draft.brands];
  }

  // Os mais vendidos vao inteiros, e a lista vazia viaja: e ela que devolve a
  // fileira ao ranking das vendas. A ordem faz parte do que mudou — arrastar
  // o terceiro card para a frente e uma alteração como qualquer outra.
  if (!sameOrder(draft.bestSellerProductIds, base.bestSellerProductIds)) {
    changes.bestSellerProductIds = [...draft.bestSellerProductIds];
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
 * Há algo pendente na tela.
 *
 * Não e o mesmo que ter mudancas: um número de WhatsApp escrito errado não
 * vira mudanca nenhuma — não há o que mandar —, e sem isto a dona digitaria
 * um número inválido e a tela não reagiria de jeito nenhum.
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
    // A sigla do estado e comparada em maiúscula porque e assim que o
    // servidor a grava: sem isso, escrever "ce" reenviaria o campo para
    // sempre.
    const value = field === 'state' ? draft[field].trim().toUpperCase() : draft[field].trim();

    if (value !== base[field].trim()) {
      changes[field] = value;
    }
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/** `null` desliga o mínimo geral: cada cidade responde pela sua regra. */
function freeShippingOf(draft: SettingsDraft): number | null {
  return draft.freeShippingMin.trim() === '' ? null : centsFromInput(draft.freeShippingMin);
}

/**
 * Só o que mudou no brinde. O servidor funde campo a campo.
 *
 * O valor meta e comparado em centavos, e não como texto: `179,9` e `179,90`
 * são a mesma quantia, e compara-los como string faria a barra de salvar
 * aparecer por causa de um zero que a dona não digitou.
 */
function giftChanges(draft: GiftDraft, base: GiftDraft): Partial<AdminGift> | null {
  const changes: Partial<AdminGift> = {};

  if (draft.isActive !== base.isActive) {
    changes.isActive = draft.isActive;
  }

  const min = giftMinOf(draft);

  if (min !== giftMinOf(base)) {
    changes.minCents = min;
  }

  // `null` viaja: e ele que tira o produto do brinde, e omitir o campo
  // deixaria a escolha antiga gravada para sempre.
  if (draft.productId !== base.productId) {
    changes.productId = draft.productId;
  }

  if (draft.label.trim() !== base.label.trim()) {
    changes.label = draft.label.trim();
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/** `null` e "sem valor meta", que e o que tira o brinde do ar. */
function giftMinOf(gift: GiftDraft): number | null {
  return gift.minValue.trim() === '' ? null : centsFromInput(gift.minValue);
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
    banner.placement === other.placement &&
    banner.startsOn === other.startsOn &&
    banner.endsOn === other.endsOn &&
    banner.isActive === other.isActive
  );
}

/**
 * Mesma lista e na mesma ordem: aqui a posição e o conteúdo.
 *
 * Serve as duas listas de texto da tela — os ids dos mais vendidos e os nomes
 * das marcas —, e nas duas arrastar o terceiro para a frente e uma alteração
 * como qualquer outra.
 */
function sameOrder(draft: readonly string[], base: readonly string[]): boolean {
  return draft.length === base.length && draft.every((id, index) => id === base[index]);
}

function sameShortcuts(
  draft: readonly ShortcutDraft[],
  base: readonly ShortcutDraft[],
): boolean {
  return (
    draft.length === base.length &&
    draft.every((shortcut, index) => sameShortcut(shortcut, base[index]))
  );
}

function sameShortcut(shortcut: ShortcutDraft, other: ShortcutDraft | undefined): boolean {
  if (other === undefined) {
    return false;
  }

  return (
    shortcut.id === other.id &&
    shortcut.label === other.label &&
    shortcut.image === other.image &&
    shortcut.targetKind === other.targetKind &&
    shortcut.targetValue === other.targetValue &&
    shortcut.isActive === other.isActive
  );
}

function samePosters(draft: readonly PosterDraft[], base: readonly PosterDraft[]): boolean {
  return (
    draft.length === base.length && draft.every((poster, index) => samePoster(poster, base[index]))
  );
}

function samePoster(poster: PosterDraft, other: PosterDraft | undefined): boolean {
  if (other === undefined) {
    return false;
  }

  return (
    poster.id === other.id &&
    poster.label === other.label &&
    poster.image === other.image &&
    poster.targetKind === other.targetKind &&
    poster.targetValue === other.targetValue &&
    poster.caption === other.caption &&
    poster.isActive === other.isActive
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
 * `order` sai da posição no array, que e a ordem que a dona arrastou. As
 * datas viram instantes: o primeiro dia começa a zero hora, e o último dia
 * termina no fim dele — "até 25/12" precisa incluir o dia 25 inteiro.
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
    placement: banner.placement,
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
