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
 * Meio minuto na borda (`SETTINGS_CACHE`), como as configurações da loja:
 * são regras que mudam algumas vezes por ano e que a vitrine consulta em toda
 * visita, para escrever "em até 3x sem juros" no card e montar o checkout.
 *
 * A janela e curta porque e a dona quem mexe nela. O ETag **não** a encurta —
 * ele poupa o corpo da resposta na revalidação, não antecipa a revalidação —,
 * e desligar o cartão no painel só chega a quem esta comprando quando a borda
 * volta a perguntar. Ver o comentário de `SETTINGS_CACHE`.
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
