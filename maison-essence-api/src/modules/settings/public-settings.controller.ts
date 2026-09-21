import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CdnCache, SETTINGS_CACHE } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { serveWithEtag } from '../../common/etag.js';
import { SettingsService } from './settings.service.js';
import type { PublicSettingsView } from './settings.view.js';

/**
 * As configuracoes que a loja aberta consome.
 *
 * Cinco minutos na CDN (`SETTINGS_CACHE`) porque esta resposta e pedida em
 * toda visita: cabecalho, rodape, barra de avisos, banners da home e o botao
 * do WhatsApp saem daqui.
 *
 * A invalidacao e por versao no ETag, e nao por expurgo na borda. O ETag
 * carrega o `updatedAt` do documento, entao todo PATCH no painel ja muda a
 * etiqueta: na primeira revalidacao depois da gravacao a CDN recebe 200 com
 * o conteudo novo, e enquanto nada muda ela recebe 304 sem corpo. E o que
 * torna a loja operavel sem redeploy — trocar o numero do WhatsApp no painel
 * troca o destino do pedido, com a janela de cache como unico atraso.
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
