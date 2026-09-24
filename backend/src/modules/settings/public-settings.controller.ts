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
 * Cinco minutos na CDN (`SETTINGS_CACHE`) porque esta resposta e pedida em
 * toda visita: cabeçalho, rodapé, barra de avisos, banners da home e o botão
 * do WhatsApp saem daqui.
 *
 * A invalidação e por versão no ETag, e não por expurgo na borda. O ETag
 * carrega o `updatedAt` do documento, então todo PATCH no painel já muda a
 * etiqueta: na primeira revalidação depois da gravação a CDN recebe 200 com
 * o conteúdo novo, e enquanto nada muda ela recebe 304 sem corpo. E o que
 * torna a loja operável sem redeploy — trocar o número do WhatsApp no painel
 * troca o destino do pedido, com a janela de cache como único atraso.
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
