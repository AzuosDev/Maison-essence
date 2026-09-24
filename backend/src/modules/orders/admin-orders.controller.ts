import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { Paginated } from '../../common/pagination.js';
import { HANDLES_ORDERS } from '../../common/roles.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';
import { UpdateOrderNotesDto } from './dto/update-order-notes.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import type { OrderSummaryView, OrderView } from './order.view.js';
import { OrdersService } from './orders.service.js';

/**
 * Pedidos pelo painel.
 *
 * `HANDLES_ORDERS` e não `MANAGES_STORE`: atender pedido e o trabalho do
 * STAFF. Ele lê, responde no WhatsApp, marca como confirmado e anota o que
 * combinou — e continua sem poder mexer em preço, em estoque ou em taxa, que
 * e o que separa este grupo do da dona.
 *
 * Não há rota de exclusão. Pedido errado e cancelado, não apagado: e ele que
 * responde "o que aconteceu com o ME-250921-4KP1?" três meses depois, e e
 * dele que sai a contabilidade do mês.
 */
@Roles(...HANDLES_ORDERS)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: ListOrdersDto): Promise<Paginated<OrderSummaryView>> {
    return this.orders.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<OrderView> {
    return this.orders.findOne(id);
  }

  /** Mover para `CANCELLED` devolve o estoque das variantes, uma vez só. */
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderView> {
    return this.orders.setStatus(actor, id, dto);
  }

  @Patch(':id/notes')
  setNotes(@Param('id') id: string, @Body() dto: UpdateOrderNotesDto): Promise<OrderView> {
    return this.orders.setNotes(id, dto);
  }
}
