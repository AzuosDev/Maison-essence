import { Body, Controller, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthenticatedCustomer } from '../customers/customer-auth.types.js';
import { OptionalCustomer } from '../customers/decorators/current-customer.decorator.js';
import { OptionalCustomerGuard } from '../customers/guards/optional-customer.guard.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import type { CreatedOrderView } from './order.view.js';
import { ORDER_IP_RATE_LIMIT } from './orders.constants.js';
import { OrdersService } from './orders.service.js';

/**
 * Validação própria do corpo do pedido, sem `forbidNonWhitelisted`.
 *
 * Mesma razão da cotação, e precisa ser a mesma: o checkout manda a sacola do
 * `localStorage`, que carrega nome, foto e preço de cada item. Se a cotação
 * ignora esses campos e o pedido os recusasse com 400, o cliente atravessaria
 * a loja inteira para esbarrar num erro de integração no último clique —
 * justamente onde ele desiste.
 *
 * O que não esta no DTO e descartado aqui, antes de qualquer conta. O preço
 * que vale e o que o servidor busca no banco; o único número do cliente que e
 * lido e `expectedTotalCents`, e ele não entra em conta nenhuma: serve para
 * ser comparado.
 */
const ORDER_BODY = new ValidationPipe({
  expectedType: CreateOrderDto,
  whitelist: true,
  transform: true,
});

/**
 * A criação do pedido pelo checkout.
 *
 * Publica, como a cotação: exigir cadastro para comprar seria perder a venda
 * na última tela, e a conta de cliente e opcional por desenho. Quem identifica
 * o pedido e o telefone.
 *
 * O limite de cinco por dez minutos por IP fica no guard; o mesmo limite por
 * telefone fica no serviço, porque só lá o número já esta normalizado. São os
 * dois lados do mesmo flood: a mesma máquina insistindo e o mesmo cliente
 * chegando de outra.
 *
 * `201` aqui, diferente do `200` da cotação: este e o único lugar do checkout
 * onde alguma coisa passa a existir.
 */
@Public()
@UseGuards(OptionalCustomerGuard)
@RateLimit(ORDER_IP_RATE_LIMIT)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * `@OptionalCustomer()` e a única coisa que a conta de cliente acrescenta
   * aqui: com sessão, o pedido nasce ligado a ela; sem sessão, `null` e o
   * checkout segue exatamente como antes. Nenhum campo do corpo mudou, e
   * nenhuma resposta depende de estar logado — a conta e uma comodidade,
   * nunca um requisito para comprar.
   */
  @Post()
  create(
    @Body(ORDER_BODY) body: object,
    @OptionalCustomer() customer: AuthenticatedCustomer | null,
  ): Promise<CreatedOrderView> {
    // O pipe acima devolve um `CreateOrderDto` validado e sem os campos que
    // não pertencem a ele; o tipo do parâmetro e `object` só para o pipe
    // global não tentar valida-lo antes (ver `cart.controller.ts`).
    return this.orders.create(body as CreateOrderDto, customer);
  }
}
