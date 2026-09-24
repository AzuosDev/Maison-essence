import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PUBLIC_PAGE_SIZE, SHELF_SIZE } from '../products.constants.js';

/**
 * Prateleira da home: destaques, pronta entrega, mais vendidos.
 *
 * Não e paginada de propósito. Prateleira e um carrossel com começo e fim —
 * quem quer navegar o catálogo inteiro vai para `/products`, que página.
 */
export class ShelfDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PUBLIC_PAGE_SIZE)
  limit?: number = SHELF_SIZE;
}
