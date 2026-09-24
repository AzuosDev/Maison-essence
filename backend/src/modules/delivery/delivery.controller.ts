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
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../../common/roles.js';
import type { DeliveryCityView } from './delivery-city.view.js';
import { DeliveryService } from './delivery.service.js';
import { CreateDeliveryCityDto } from './dto/create-delivery-city.dto.js';
import { ReorderDeliveryCitiesDto } from './dto/reorder-delivery-cities.dto.js';
import { UpdateDeliveryCityDto } from './dto/update-delivery-city.dto.js';

/**
 * Cidades de entrega pelo painel.
 *
 * `MANAGES_STORE` sem exceção, inclusive na leitura: a tabela de taxas e
 * preço, e preço e da dona. O STAFF não precisa dela — o pedido que ele
 * atende já carrega a taxa combinada em copia própria.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/delivery-cities')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  list(): Promise<DeliveryCityView[]> {
    return this.delivery.list();
  }

  @Post()
  create(@Body() dto: CreateDeliveryCityDto): Promise<DeliveryCityView> {
    return this.delivery.create(dto);
  }

  /**
   * Antes do `PATCH :id` de propósito: o Nest casa as rotas na ordem em que
   * são declaradas, e `reorder` cairia em `:id` como se fosse um id.
   */
  @Patch('reorder')
  reorder(@Body() dto: ReorderDeliveryCitiesDto): Promise<DeliveryCityView[]> {
    return this.delivery.reorder(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryCityDto,
  ): Promise<DeliveryCityView> {
    return this.delivery.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.delivery.remove(id);
  }
}
