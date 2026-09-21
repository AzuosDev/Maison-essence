import { Body, Controller, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import type { CreatedOrderView } from './order.view.js';
import { ORDER_IP_RATE_LIMIT } from './orders.constants.js';
import { OrdersService } from './orders.service.js';

/**
 * Validacao propria do corpo do pedido, sem `forbidNonWhitelisted`.
 *
 * Mesma razao da cotacao, e precisa ser a mesma: o checkout manda a sacola do
 * `localStorage`, que carrega nome, foto e preco de cada item. Se a cotacao
 * ignora esses campos e o pedido os recusasse com 400, o cliente atravessaria
 * a loja inteira para esbarrar num erro de integracao no ultimo clique —
 * justamente onde ele desiste.
 *
 * O que nao esta no DTO e descartado aqui, antes de qualquer conta. O preco
 * que vale e o que o servidor busca no banco; o unico numero do cliente que e
 * lido e `expectedTotalCents`, e ele nao entra em conta nenhuma: serve para
 * ser comparado.
 */
const ORDER_BODY = new ValidationPipe({
  expectedType: CreateOrderDto,
  whitelist: true,
  transform: true,
});

/**
 * A criacao do pedido pelo checkout.
 *
 * Publica, como a cotacao: exigir cadastro para comprar seria perder a venda
 * na ultima tela, e a conta de cliente e opcional por desenho. Quem identifica
 * o pedido e o telefone.
 *
 * O limite de cinco por dez minutos por IP fica no guard; o mesmo limite por
 * telefone fica no servico, porque so la o numero ja esta normalizado. Sao os
 * dois lados do mesmo flood: a mesma maquina insistindo e o mesmo cliente
 * chegando de outra.
 *
 * `201` aqui, diferente do `200` da cotacao: este e o unico lugar do checkout
 * onde alguma coisa passa a existir.
 */
@Public()
@UseGuards(RateLimitGuard)
@RateLimit(ORDER_IP_RATE_LIMIT)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body(ORDER_BODY) body: object): Promise<CreatedOrderView> {
    // O pipe acima devolve um `CreateOrderDto` validado e sem os campos que
    // nao pertencem a ele; o tipo do parametro e `object` so para o pipe
    // global nao tentar valida-lo antes (ver `cart.controller.ts`).
    return this.orders.create(body as CreateOrderDto);
  }
}
