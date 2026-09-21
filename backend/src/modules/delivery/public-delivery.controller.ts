import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CdnCache } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { serveWithEtag } from '../../common/etag.js';
import type { PublicDeliveryCityView } from './delivery-city.view.js';
import { DeliveryService } from './delivery.service.js';

/**
 * As cidades que a loja atende, para a sacola e o checkout.
 *
 * Cache do catalogo, e nao o das configuracoes: aqui viaja preco. A taxa
 * entra na conta que o cliente ve antes de mandar o pedido, e uma janela
 * curta na borda e o que evita que um reajuste demore cinco minutos para
 * chegar a tela de quem ja esta comprando. O ETag encurta o resto — muda no
 * instante em que a dona grava a cidade ou o minimo global de frete gratis.
 */
@Public()
@CdnCache()
@Controller('delivery-cities')
export class PublicDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  async list(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicDeliveryCityView[] | undefined> {
    const { payload, updatedAt } = await this.delivery.publicList();

    return serveWithEtag(request, response, updatedAt, payload);
  }
}
