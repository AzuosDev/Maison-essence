import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ORDER_STATUS_VALUES } from '../../../common/enums/order-status.js';
import type { OrderStatus } from '../../../common/enums/order-status.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../orders.constants.js';

/** A busca da tela de pedidos. Tudo opcional, tudo combinavel. */
export class ListOrdersDto {
  @IsOptional()
  @IsIn(ORDER_STATUS_VALUES, { message: 'status invalido' })
  status?: OrderStatus;

  /**
   * Periodo pela data de criacao. `@Type(() => Date)` converte o texto da
   * query string; sem isso, `from=2026-09-01` chegaria como string e
   * reprovaria no `@IsDate`.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data inicial invalida' })
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data final invalida' })
  to?: Date;

  /**
   * Codigo do pedido ou telefone do cliente.
   *
   * Um campo so, e nao dois, porque e assim que a dona procura: ela tem na
   * mao o que o cliente mandou — `ME-250921-4KP1` colado da conversa, ou os
   * ultimos digitos do numero que esta ligando — e nao quer decidir em qual
   * caixa digitar.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;
}
