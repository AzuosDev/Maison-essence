import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { BANNER_PLACEMENTS } from '../../common/enums/banner-placement.js';
import { Product } from '../../schemas.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditActor } from '../audit/audit.types.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { hasValidWindow, unknownBannerIds } from './banners.js';
import { liveGift } from './gift.js';
import type { GiftOffer, GiftProduct } from './gift.js';
import type { BannerDto } from './dto/banner.dto.js';
import type { CollectionPosterDto } from './dto/poster.dto.js';
import type { ShortcutDto } from './dto/shortcut.dto.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { upsertPages } from './institutional-pages.js';
import { StoreSettings } from './schemas/store-settings.schema.js';
import type {
  StoreSettingsDocument,
  StoreSettingsModel,
} from './schemas/store-settings.schema.js';
import { unknownPosterIds } from './posters.js';
import { unknownShortcutIds } from './shortcuts.js';
import {
  INVALID_BANNER_WINDOW_MESSAGE,
  PAGE_NOT_FOUND_MESSAGE,
  unknownBannersMessage,
  unknownPostersMessage,
  unknownShortcutsMessage,
} from './settings.constants.js';
import { assertCanEditSettings } from './settings-access.policy.js';
import { diffOf } from './settings.diff.js';
import type { AuditSnapshot } from './settings.diff.js';
import {
  toEditablePage,
  toPageViews,
  toPublicPageSummaries,
  toPublicPageView,
  toPublicSettingsView,
  toSettingsView,
} from './settings.view.js';
import type {
  PublicPageSummary,
  PublicPageView,
  PublicSettingsView,
  SettingsView,
} from './settings.view.js';

/**
 * Resposta publica junto da data que a versiona.
 *
 * O `updatedAt` não vai no corpo — e estado do painel, não informação da loja
 * — mas o controller precisa dele para montar o ETag, que e o que faz a borda
 * largar a copia velha assim que a dona grava (ver `common/etag.ts`).
 */
export interface Versioned<T> {
  payload: T;
  updatedAt: Date;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(StoreSettings.name) private readonly settings: StoreSettingsModel,
    // O catálogo entra por uma pergunta só: qual e a foto e o nome do produto
    // que a dona escolheu como brinde. E o model, e não o serviço de
    // produtos, pelo mesmo motivo que a vitrine lê `StoreSettings` assim —
    // ler um documento não justifica acoplar os dois domínios.
    @InjectModel(Product.name) private readonly products: Model<Product>,
    private readonly audit: AuditService,
  ) {}

  /**
   * O documento único das configurações, criado com os padrões na primeira
   * leitura.
   *
   * E por aqui que os outros módulos leem a loja — o de pedidos vai buscar
   * aqui o número para onde a mensagem do cliente e enviada. Ler do banco a
   * cada pedido, e não de uma constante do build, e o que cumpre a promessa
   * do painel: trocar o número muda o destino da próxima mensagem, sem
   * redeploy.
   */
  current(): Promise<StoreSettingsDocument> {
    return this.settings.getOrCreate();
  }

  /** As configurações como o painel as vê. */
  async adminView(): Promise<SettingsView> {
    return toSettingsView(await this.current());
  }

  /** O subconjunto que a loja aberta recebe, com os banners vigentes agora. */
  async publicView(now: Date = new Date()): Promise<Versioned<PublicSettingsView>> {
    const settings = await this.current();
    const product = await this.giftProduct(settings);

    return {
      payload: toPublicSettingsView(settings, now, product),
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * O brinde de pé, para quem precisa dele fora da resposta publica.
   *
   * Existe por causa do pedido: a mensagem que chega no WhatsApp da dona diz
   * qual brinde separar, e ela precisa da mesma frase que o site prometeu.
   * Devolver `GiftOffer` e não os campos crus e o que garante isso — a regra
   * de quando o brinde vale mora em um lugar só (`gift.ts`).
   */
  async giftOffer(settings?: StoreSettingsDocument): Promise<GiftOffer | null> {
    const current = settings ?? (await this.current());

    return liveGift(current.gift, await this.giftProduct(current));
  }

  /**
   * A foto e o nome do produto escolhido como brinde.
   *
   * Sem produto escolhido não há consulta. Produto excluído do cadastro
   * devolve `null` e o brinde segue valendo pela frase escrita no painel — a
   * promessa e da loja, não do catálogo, e um balão sem foto e melhor do que
   * uma campanha que some porque alguém apagou um produto.
   */
  private async giftProduct(settings: StoreSettingsDocument): Promise<GiftProduct | null> {
    const { productId } = settings.gift;

    if (productId === null) {
      return null;
    }

    const product = await this.products
      .findById(productId)
      .select('name images')
      .lean<{ name: string; images: string[] } | null>()
      .exec();

    return product === null ? null : { name: product.name, image: product.images[0] ?? '' };
  }

  /** Páginas publicadas, para o rodapé montar os links. */
  async publicPages(): Promise<Versioned<PublicPageSummary[]>> {
    const settings = await this.current();

    return { payload: toPublicPageSummaries(settings), updatedAt: settings.updatedAt };
  }

  /**
   * Uma página pelo endereço.
   *
   * Página despublicada responde 404, e não 403: para quem esta de fora, ela
   * simplesmente não existe ainda.
   */
  async publicPage(slug: string): Promise<Versioned<PublicPageView>> {
    const settings = await this.current();
    const found = toPageViews(settings).find((page) => page.slug === slug && page.isActive);

    if (!found) {
      throw new NotFoundException(PAGE_NOT_FOUND_MESSAGE);
    }

    return { payload: toPublicPageView(found), updatedAt: settings.updatedAt };
  }

  /**
   * Grava as configurações e registra na auditoria o que mudou.
   *
   * O retrato de antes e o de depois saem do mesmo documento, o segundo já
   * com o que o Mongoose normalizou no `save` — `trim`, sigla do estado em
   * maiúscula, e-mail em minúscula. E o valor que ficou gravado que entra na
   * trilha, não o que o painel digitou.
   */
  async update(actor: AuthenticatedUser, dto: UpdateSettingsDto): Promise<SettingsView> {
    // Antes de ler o documento: o gerente abre esta tela inteira, mas grava
    // só o que e da operação. A recusa vale para o corpo todo, e por isso
    // precisa vir antes de qualquer `set` — ver `settings-access.policy.ts`.
    assertCanEditSettings(actor, dto);

    const settings = await this.current();
    const before = auditSnapshot(settings);

    this.applyScalars(settings, dto);
    this.applyBlocks(settings, dto);

    if (dto.banners !== undefined) {
      settings.set('banners', this.plannedBanners(settings, dto.banners));
    }

    if (dto.shortcuts !== undefined) {
      settings.set('shortcuts', this.plannedShortcuts(settings, dto.shortcuts));
    }

    if (dto.posters !== undefined) {
      settings.set('posters', this.plannedPosters(settings, dto.posters));
    }

    // A fileira de mais vendidos e a lista crua, sem planejamento nenhum: ela
    // não tem linha com identidade própria como o banner e o atalho — e uma
    // ordem de ids, e os ids são do catálogo. O Mongoose converte o texto em
    // `ObjectId` na gravação, como em qualquer referência.
    if (dto.bestSellerProductIds !== undefined) {
      settings.set('bestSellerProductIds', dto.bestSellerProductIds);
    }

    // A faixa de marcas e crua pelo mesmo motivo: e uma ordem de nomes, e os
    // nomes vem do cadastro dos produtos. Quem confere se alguem tem aquela
    // grafia escrita e o painel, que escolhe de uma lista tirada do catalogo.
    if (dto.brands !== undefined) {
      settings.set('brands', dto.brands);
    }

    if (dto.institutionalPages !== undefined) {
      settings.set(
        'institutionalPages',
        upsertPages(settings.institutionalPages.map(toEditablePage), dto.institutionalPages),
      );
    }

    await settings.save();

    const changes = diffOf(before, auditSnapshot(settings));

    // PATCH que não mudou nada — a tela salva sem edição — não vira linha de
    // auditoria: a trilha existe para mostrar alteração, e ruído nela custa a
    // confiança de quem a lê.
    if (Object.keys(changes).length > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        actor: toParty(actor),
        changes,
      });
    }

    return toSettingsView(settings);
  }

  /** Campos de valor único: o que veio substitui o que estava. */
  private applyScalars(settings: StoreSettingsDocument, dto: UpdateSettingsDto): void {
    const scalars = [
      'storeName',
      'whatsappNumber',
      'announcementText',
      'contactEmail',
      'businessHours',
      'pickupEnabled',
      'pickupInstructions',
      'freeShippingMinCents',
      // O id do perfume da vez chega como texto e o Mongoose o converte na
      // gravação, como em qualquer referência.
      'featuredPerfumeProductId',
    ] as const;

    for (const field of scalars) {
      const value = dto[field];

      if (value !== undefined) {
        settings.set(field, value);
      }
    }
  }

  /**
   * Blocos aninhados: fusão campo a campo.
   *
   * Substituir o bloco inteiro apagaria o que a tela não mandou — corrigir o
   * número da casa não pode limpar o ponto de referência, trocar o Instagram
   * não pode sumir com o TikTok, e mudar o valor meta do brinde não pode
   * apagar a frase do balão.
   */
  private applyBlocks(settings: StoreSettingsDocument, dto: UpdateSettingsDto): void {
    for (const block of ['pickupAddress', 'socialLinks', 'gift'] as const) {
      const received = dto[block];

      if (received === undefined) {
        continue;
      }

      for (const [field, value] of Object.entries(received)) {
        if (value !== undefined) {
          settings.set(`${block}.${field}`, value);
        }
      }
    }
  }

  /**
   * O carrossel recebido, pronto para substituir o gravado.
   *
   * O `_id` de cada banner e preservado quando o painel manda o `id`: e ele
   * que identifica a arte entre uma gravação e outra, e e por ele que o
   * módulo de uploads sabe que a imagem ainda esta em uso antes de deixar
   * apaga-lá. Banner sem `id` e novo e ganha o seu.
   */
  private plannedBanners(
    settings: StoreSettingsDocument,
    incoming: readonly BannerDto[],
  ): Record<string, unknown>[] {
    const unknown = unknownBannerIds(
      incoming,
      settings.banners.map((banner) => banner.id),
    );

    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        message: unknownBannersMessage(unknown),
        details: { unknownIds: unknown },
      });
    }

    return incoming.map((banner, index) => {
      const startsAt = banner.startsAt ?? null;
      const endsAt = banner.endsAt ?? null;

      if (!hasValidWindow({ startsAt, endsAt })) {
        throw new UnprocessableEntityException({
          message: INVALID_BANNER_WINDOW_MESSAGE,
          details: { index, startsAt, endsAt },
        });
      }

      return {
        _id: banner.id === undefined ? new Types.ObjectId() : new Types.ObjectId(banner.id),
        imageDesktop: banner.imageDesktop,
        imageMobile: banner.imageMobile ?? '',
        title: banner.title ?? '',
        subtitle: banner.subtitle ?? '',
        buttonLabel: banner.buttonLabel ?? '',
        link: banner.link ?? '',
        // Sem `placement`, o banner vai para o topo: e onde todos estavam
        // antes de a vaga do meio existir, e e o que um painel antigo manda.
        placement: banner.placement ?? BANNER_PLACEMENTS.HERO,
        // Sem `order`, vale a posição na lista que a dona arrastou na tela.
        order: banner.order ?? index,
        startsAt,
        endsAt,
        isActive: banner.isActive ?? true,
      };
    });
  }

  /**
   * A fileira recebida, pronta para substituir a gravada.
   *
   * Mesma regra do carrossel: o `_id` de cada atalho é preservado quando o
   * painel manda o `id` — é ele que identifica a foto entre uma gravação e
   * outra, e é por ele que o módulo de uploads sabe que a imagem ainda está
   * em uso. Atalho sem `id` é novo e ganha o seu.
   */
  private plannedShortcuts(
    settings: StoreSettingsDocument,
    incoming: readonly ShortcutDto[],
  ): Record<string, unknown>[] {
    const unknown = unknownShortcutIds(
      incoming,
      settings.shortcuts.map((shortcut) => shortcut.id),
    );

    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        message: unknownShortcutsMessage(unknown),
        details: { unknownIds: unknown },
      });
    }

    return incoming.map((shortcut, index) => ({
      _id: shortcut.id === undefined ? new Types.ObjectId() : new Types.ObjectId(shortcut.id),
      label: shortcut.label,
      image: shortcut.image ?? '',
      link: shortcut.link,
      // Sem `order`, vale a posição na lista que a dona arrastou na tela.
      order: shortcut.order ?? index,
      isActive: shortcut.isActive ?? true,
    }));
  }

  /**
   * A faixa de cartazes recebida, pronta para substituir a gravada.
   *
   * Mesma regra do carrossel e dos atalhos: o `_id` de cada cartaz é
   * preservado quando o painel manda o `id` — é ele que identifica a arte
   * entre uma gravação e outra, e é por ele que o módulo de uploads sabe que
   * a imagem ainda está em uso.
   */
  private plannedPosters(
    settings: StoreSettingsDocument,
    incoming: readonly CollectionPosterDto[],
  ): Record<string, unknown>[] {
    const unknown = unknownPosterIds(
      incoming,
      settings.posters.map((poster) => poster.id),
    );

    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        message: unknownPostersMessage(unknown),
        details: { unknownIds: unknown },
      });
    }

    return incoming.map((poster, index) => ({
      _id: poster.id === undefined ? new Types.ObjectId() : new Types.ObjectId(poster.id),
      label: poster.label,
      image: poster.image,
      link: poster.link,
      caption: poster.caption ?? '',
      // Sem `order`, vale a posição na lista que a dona arrastou na tela.
      order: poster.order ?? index,
      isActive: poster.isActive ?? true,
    }));
  }
}

/**
 * Retrato das configurações para a auditoria.
 *
 * Banners, atalhos, cartazes e páginas viram objetos indexados por `id` e por
 * `slug` em
 * vez de arrays: assim o diff diz "o banner tal mudou de data" e não "a lista
 * de banners mudou", que e o que sairia de uma comparação por posição.
 *
 * As datas viram texto ISO porque dois `Date` com o mesmo instante são
 * objetos diferentes, e o diff registraria alteração onde não houve.
 */
function auditSnapshot(settings: StoreSettingsDocument): AuditSnapshot {
  const { pickupAddress, socialLinks, gift } = settings;

  return {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    announcementText: settings.announcementText,
    contactEmail: settings.contactEmail,
    businessHours: settings.businessHours,
    pickupEnabled: settings.pickupEnabled,
    pickupInstructions: settings.pickupInstructions,
    freeShippingMinCents: settings.freeShippingMinCents,
    // Texto, e não `ObjectId`: dois ids iguais são objetos diferentes, e o
    // diff registraria alteração onde não houve.
    featuredPerfumeProductId: settings.featuredPerfumeProductId?.toHexString() ?? null,
    // Lista de texto, e não de `ObjectId`: o diff compara array como valor
    // único — a ordem faz parte do que mudou — e dois ids iguais são objetos
    // diferentes, o que registraria alteração onde não houve.
    bestSellerProductIds: settings.bestSellerProductIds.map((id) => id.toHexString()),
    // Idem: a ordem faz parte do que mudou, e o array vale como um valor so.
    brands: [...settings.brands],
    pickupAddress: {
      street: pickupAddress.street,
      number: pickupAddress.number,
      complement: pickupAddress.complement,
      district: pickupAddress.district,
      city: pickupAddress.city,
      state: pickupAddress.state,
      zipCode: pickupAddress.zipCode,
      reference: pickupAddress.reference,
    },
    socialLinks: { instagram: socialLinks.instagram, tiktok: socialLinks.tiktok },
    gift: {
      isActive: gift.isActive,
      minCents: gift.minCents,
      // Texto, e não `ObjectId`, como o perfume da vez: o diff registraria
      // alteração onde não houve.
      productId: gift.productId?.toHexString() ?? null,
      label: gift.label,
    },
    banners: Object.fromEntries(
      settings.banners.map((banner) => [
        banner.id,
        {
          imageDesktop: banner.imageDesktop,
          imageMobile: banner.imageMobile,
          title: banner.title,
          subtitle: banner.subtitle,
          buttonLabel: banner.buttonLabel,
          link: banner.link,
          placement: banner.placement,
          order: banner.order,
          startsAt: banner.startsAt?.toISOString() ?? null,
          endsAt: banner.endsAt?.toISOString() ?? null,
          isActive: banner.isActive,
        },
      ]),
    ),
    shortcuts: Object.fromEntries(
      settings.shortcuts.map((shortcut) => [
        shortcut.id,
        {
          label: shortcut.label,
          image: shortcut.image,
          link: shortcut.link,
          order: shortcut.order,
          isActive: shortcut.isActive,
        },
      ]),
    ),
    posters: Object.fromEntries(
      settings.posters.map((poster) => [
        poster.id,
        {
          label: poster.label,
          image: poster.image,
          link: poster.link,
          caption: poster.caption,
          order: poster.order,
          isActive: poster.isActive,
        },
      ]),
    ),
    institutionalPages: Object.fromEntries(
      settings.institutionalPages.map((page) => [
        page.slug,
        { title: page.title, content: page.content, isActive: page.isActive },
      ]),
    ),
  };
}

function toParty(actor: AuthenticatedUser): AuditActor {
  return { id: actor.id, email: actor.email, role: actor.role };
}
