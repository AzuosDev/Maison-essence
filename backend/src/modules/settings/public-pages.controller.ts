import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CdnCache, SETTINGS_CACHE } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { serveWithEtag } from '../../common/etag.js';
import { SettingsService } from './settings.service.js';
import type { PublicPageSummary, PublicPageView } from './settings.view.js';

/**
 * Páginas institucionais da loja aberta.
 *
 * Endereço fixo e sem id: `/pages/politica-de-privacidade` e um link que vai
 * para o rodapé, para o WhatsApp e, no caso da política, para o registro de
 * um terceiro. Por isso o slug vem de uma lista fechada e a dona edita só o
 * título e o texto.
 *
 * Mesmo cache das configurações: são os mesmos cinco campos de texto, mudam
 * na mesma frequência, e a listagem daqui monta o rodapé de toda página.
 */
@Public()
@CdnCache(SETTINGS_CACHE)
@Controller('pages')
export class PublicPagesController {
  constructor(private readonly settings: SettingsService) {}

  /** Só as publicadas, sem o conteúdo: o rodapé precisa de título e endereço. */
  @Get()
  async list(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicPageSummary[] | undefined> {
    const { payload, updatedAt } = await this.settings.publicPages();

    return serveWithEtag(request, response, updatedAt, payload);
  }

  @Get(':slug')
  async bySlug(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicPageView | undefined> {
    const { payload, updatedAt } = await this.settings.publicPage(slug);

    return serveWithEtag(request, response, updatedAt, payload);
  }
}
