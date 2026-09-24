import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_ORDERS_PAGE_SIZE, MAX_ORDERS_PAGE_SIZE } from '../customers.constants.js';

/** Paginação do histórico. Sem filtros: o cliente tem poucos pedidos. */
export class ListCustomerOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ORDERS_PAGE_SIZE)
  limit?: number = DEFAULT_ORDERS_PAGE_SIZE;
}
