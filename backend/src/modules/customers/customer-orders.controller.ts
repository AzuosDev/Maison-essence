import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Paginated } from '../../common/pagination.js';
import type { CustomerOrderView, OrderSummaryView } from '../orders/order.view.js';
import { CustomerOrdersService } from './customer-orders.service.js';
import type { AuthenticatedCustomer } from './customer-auth.types.js';
import { CustomerAuth } from './decorators/customer-auth.decorator.js';
import { CurrentCustomer } from './decorators/current-customer.decorator.js';
import { ListCustomerOrdersDto } from './dto/list-customer-orders.dto.js';

/**
 * Os pedidos da própria conta.
 *
 * Pelo código, e não pelo id, na rota de um pedido só: `ME-250921-4KP1` e o
 * que o cliente tem a mão — esta na mensagem que ele mandou para a loja e no
 * comprovante que guardou. Pedir um ObjectId obrigaria a tela a listar antes
 * de poder abrir, e o link que o cliente colou do WhatsApp não funcionaria.
 *
 * Quem só pode ver o próprio pedido e o filtro por `customerId` no serviço, e
 * não a rota: aqui o código entra como veio.
 */
@CustomerAuth()
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly orders: CustomerOrdersService) {}

  @Get()
  list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query() query: ListCustomerOrdersDto,
  ): Promise<Paginated<OrderSummaryView>> {
    return this.orders.list(customer.id, query);
  }

  @Get(':code')
  findOne(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('code') code: string,
  ): Promise<CustomerOrderView> {
    return this.orders.findByCode(customer.id, code);
  }
}
