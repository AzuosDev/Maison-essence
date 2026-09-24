import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditActor } from '../audit/audit.types.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { hasValidWindow, unknownBannerIds } from './banners.js';
import type { BannerDto } from './dto/banner.dto.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { upsertPages } from './institutional-pages.js';
import { StoreSettings } from './schemas/store-settings.schema.js';
import type {
  StoreSettingsDocument,
  StoreSettingsModel,
} from './schemas/store-settings.schema.js';
import {
  INVALID_BANNER_WINDOW_MESSAGE,
  PAGE_NOT_FOUND_MESSAGE,
  unknownBannersMessage,
} from './settings.constants.js';
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

    return { payload: toPublicSettingsView(settings, now), updatedAt: settings.updatedAt };
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
    const settings = await this.current();
    const before = auditSnapshot(settings);

    this.applyScalars(settings, dto);
    this.applyBlocks(settings, dto);

    if (dto.banners !== undefined) {
      settings.set('banners', this.plannedBanners(settings, dto.banners));
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
   * número da casa não pode limpar o ponto de referência, e trocar o
   * Instagram não pode sumir com o TikTok.
   */
  private applyBlocks(settings: StoreSettingsDocument, dto: UpdateSettingsDto): void {
    for (const block of ['pickupAddress', 'socialLinks'] as const) {
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
        // Sem `order`, vale a posição na lista que a dona arrastou na tela.
        order: banner.order ?? index,
        startsAt,
        endsAt,
        isActive: banner.isActive ?? true,
      };
    });
  }
}

/**
 * Retrato das configurações para a auditoria.
 *
 * Banners e páginas viram objetos indexados por `id` e por `slug` em vez de
 * arrays: assim o diff diz "o banner tal mudou de data" e não "a lista de
 * banners mudou", que e o que sairia de uma comparação por posição.
 *
 * As datas viram texto ISO porque dois `Date` com o mesmo instante são
 * objetos diferentes, e o diff registraria alteração onde não houve.
 */
function auditSnapshot(settings: StoreSettingsDocument): AuditSnapshot {
  const { pickupAddress, socialLinks } = settings;

  return {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    announcementText: settings.announcementText,
    contactEmail: settings.contactEmail,
    businessHours: settings.businessHours,
    pickupEnabled: settings.pickupEnabled,
    pickupInstructions: settings.pickupInstructions,
    freeShippingMinCents: settings.freeShippingMinCents,
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
          order: banner.order,
          startsAt: banner.startsAt?.toISOString() ?? null,
          endsAt: banner.endsAt?.toISOString() ?? null,
          isActive: banner.isActive,
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
