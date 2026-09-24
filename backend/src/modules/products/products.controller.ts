import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { Paginated } from '../../common/pagination.js';
import { MANAGES_STORE, READS_CATALOG } from '../../common/roles.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import type { ProductView } from './product.view.js';
import { ProductsService } from './products.service.js';

/**
 * Produtos pelo painel.
 *
 * Mesma divisão das categorias: gravar e da dona (`MANAGES_STORE`), ler e do
 * STAFF também, que precisa consultar preço e estoque para atender no
 * WhatsApp sem poder remarcar nada.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Roles(...READS_CATALOG)
  @Get()
  list(@Query() query: ListProductsDto): Promise<Paginated<ProductView>> {
    return this.products.list(query);
  }

  @Roles(...READS_CATALOG)
  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductView> {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto): Promise<ProductView> {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductView> {
    return this.products.update(actor, id, dto);
  }

  /** Toggle da listagem, sem passar pelo cadastro inteiro. */
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ): Promise<ProductView> {
    return this.products.setStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.products.remove(id);
  }
}
