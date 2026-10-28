import { Controller, Get, Param, Query } from '@nestjs/common';
import { CdnCache } from '../../common/cache-control.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { Paginated } from '../../common/pagination.js';
import { ListPublicProductsDto } from './dto/list-public-products.dto.js';
import { ShelfDto } from './dto/shelf.dto.js';
import { PublicCatalogService } from './public-catalog.service.js';
import type { PublicProductDetailView, PublicProductView } from './public-product.view.js';

/**
 * O catálogo da loja aberta.
 *
 * `@Public()` porque e a vitrine, e `@CdnCache()` porque e o tráfego que a
 * CDN da Vercel precisa absorver: a função serverless só e acionada quando a
 * borda não tem resposta fresca.
 */
@Public()
@CdnCache()
@Controller('products')
export class PublicProductsController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get()
  list(@Query() query: ListPublicProductsDto): Promise<Paginated<PublicProductView>> {
    return this.catalog.list(query);
  }

  // As rotas de nome fixo vem antes de `:slug` de propósito: o Nest casa na
  // ordem de declaração, e depois do parâmetro `featured` seria o slug de um
  // produto chamado "featured".
  @Get('featured')
  featured(@Query() query: ShelfDto): Promise<PublicProductView[]> {
    return this.catalog.featured(query.limit);
  }

  @Get('ready-to-ship')
  readyToShip(@Query() query: ShelfDto): Promise<PublicProductView[]> {
    return this.catalog.readyToShip(query.limit);
  }

  @Get('best-sellers')
  bestSellers(@Query() query: ShelfDto): Promise<PublicProductView[]> {
    return this.catalog.bestSellers(query.limit);
  }

  /**
   * O produto da seção "O perfume da vez", montado como a página dele.
   *
   * 404 quando a loja não tem o que mostrar ali — nem escolha em Ajustes nem
   * destaque marcado. E a resposta certa: a seção não existe, e não existe
   * seção vazia.
   */
  @Get('perfume-of-the-week')
  perfumeOfTheWeek(): Promise<PublicProductDetailView> {
    return this.catalog.perfumeOfTheWeek();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<PublicProductDetailView> {
    return this.catalog.findBySlug(slug);
  }
}
