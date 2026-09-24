import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ORDER_STATUS_VALUES } from '../../../common/enums/order-status.js';
import type { OrderStatus } from '../../../common/enums/order-status.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../orders.constants.js';

/** A busca da tela de pedidos. Tudo opcional, tudo combinável. */
export class ListOrdersDto {
  @IsOptional()
  @IsIn(ORDER_STATUS_VALUES, { message: 'status inválido' })
  status?: OrderStatus;

  /**
   * Período pela data de criação. `@Type(() => Date)` converte o texto da
   * query string; sem isso, `from=2026-09-01` chegaria como string e
   * reprovaria no `@IsDate`.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data inicial inválida' })
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data final inválida' })
  to?: Date;

  /**
   * Código do pedido ou telefone do cliente.
   *
   * Um campo só, e não dois, porque e assim que a dona procura: ela tem na
   * mão o que o cliente mandou — `ME-250921-4KP1` colado da conversa, ou os
   * últimos digitos do número que esta ligando — e não quer decidir em qual
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
