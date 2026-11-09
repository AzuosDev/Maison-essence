import { Controller, Get, Param } from '@nestjs/common';
import { CdnCache, SETTINGS_CACHE } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { PublicCampaignView } from './coupon.view.js';
import { CouponsService } from './coupons.service.js';

/**
 * A campanha, para a loja aberta.
 *
 * ## Por que a janela de cache e a das configurações, e não a do catálogo
 *
 * Porque aqui viaja um número que se gasta. O nome da campanha e o desconto
 * aguentariam os cinco minutos do catálogo, mas `scarcityLabel` conta cupons
 * restantes — e "Restam 2" guardado na borda enquanto os dois últimos são
 * vendidos e a loja prometendo o que vai recusar no fechamento. Trinta segundos
 * ainda absorvem a rajada de quem chega por um link de story, que e o tráfego
 * que esta janela existe para segurar.
 *
 * Nenhum ETag. Ele economiza corpo na revalidação e não faz a borda revalidar
 * mais cedo (ver `SETTINGS_CACHE`), e o `updatedAt` do cupom não mudaria de
 * todo jeito: o que muda nesta resposta e a contagem de pedidos, que vive em
 * outra coleção.
 *
 * ## O que não esta aqui
 *
 * Os produtos da campanha. Eles vem de `GET /products?campanha=<slug>`, que já
 * sabe montar card com preço, parcela, selo de pronta entrega e paginação — e
 * que e a mesma rota da vitrine, então a página da campanha herda ordenação e
 * filtros sem nada escrito duas vezes.
 */
@Public()
@CdnCache(SETTINGS_CACHE)
@Controller('campaigns')
export class PublicCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /**
   * A campanha que a home anuncia.
   *
   * Devolve um objeto com um campo, e não a campanha solta, porque a ausência
   * precisa ser legível: `{ campaign: null }` diz "consultei e não há nenhuma",
   * enquanto um `null` solto chega ao navegador como corpo vazio e obriga a
   * tela a tratar isso como caso especial. Loja sem campanha e o caso comum,
   * não a exceção.
   */
  @Get('live')
  async live(): Promise<{ campaign: PublicCampaignView | null }> {
    return { campaign: await this.coupons.liveCampaign() };
  }

  /** A campanha de um endereço. 404 quando ela não esta no ar. */
  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<PublicCampaignView> {
    return this.coupons.campaignBySlug(slug);
  }
}
