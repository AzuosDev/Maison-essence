import { IsIn } from 'class-validator';
import { ORDER_STATUS_VALUES } from '../../../common/enums/order-status.js';
import type { OrderStatus } from '../../../common/enums/order-status.js';

/**
 * O novo status do pedido.
 *
 * Sem maquina de estados: a dona move o pedido na ordem que a vida dela pede
 * — um pedido pago no balcao pula direto para entregue, e um que voltou dos
 * Correios volta para preparando. O unico caminho sem volta e o cancelamento,
 * porque so ele mexe no estoque (ver `orders.constants.ts`).
 */
export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUS_VALUES, { message: 'status invalido' })
  status: OrderStatus;
}
