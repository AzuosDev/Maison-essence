import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CdnCache, SETTINGS_CACHE } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { serveWithEtag } from '../../common/etag.js';
import { SettingsService } from './settings.service.js';
import type { PublicSettingsView } from './settings.view.js';

/**
 * As configurações que a loja aberta consome.
 *
 * Meio minuto na CDN (`SETTINGS_CACHE`), e não mais: esta resposta e pedida
 * em toda visita — cabeçalho, rodapé, barra de avisos, banners da home e o
 * botão do WhatsApp saem daqui —, mas e também a que a dona edita no painel
 * esperando ver o resultado na loja.
 *
 * Não há expurgo na borda: a Vercel não oferece um para função comum, e o
 * ETag não faz as vezes de um. Ele carrega o `updatedAt`, então todo PATCH
 * muda a etiqueta — só que a borda só compara etiquetas quando *decide*
 * revalidar, e essa decisão e a janela, não o ETag. O que o ETag entrega e
 * revalidação barata: enquanto nada muda ela custa um 304 sem corpo, e e isso
 * que torna uma janela de trinta segundos sustentável.
 */
@Public()
@CdnCache(SETTINGS_CACHE)
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicSettingsView | undefined> {
    const { payload, updatedAt } = await this.settings.publicView();

    return serveWithEtag(request, response, updatedAt, payload);
  }
}
