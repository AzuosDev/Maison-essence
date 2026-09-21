import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CdnCache, SETTINGS_CACHE } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { serveWithEtag } from '../../common/etag.js';
import type { PublicPaymentSettingsView } from './payment-settings.view.js';
import { PaymentsService } from './payments.service.js';

/**
 * As formas de pagamento que a loja aberta anuncia.
 *
 * Cinco minutos na borda (`SETTINGS_CACHE`), como as configuracoes da loja:
 * sao regras que mudam algumas vezes por ano e que a vitrine consulta em toda
 * visita, para escrever "em ate 3x sem juros" no card e montar o checkout. O
 * ETag encurta a janela real — desligar o cartao no painel muda a etiqueta na
 * mesma hora, e a proxima revalidacao ja entrega a resposta sem a opcao.
 */
@Public()
@CdnCache(SETTINGS_CACHE)
@Controller('payment-settings')
export class PublicPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  async get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicPaymentSettingsView | undefined> {
    const { payload, updatedAt } = await this.payments.publicView();

    return serveWithEtag(request, response, updatedAt, payload);
  }
}
