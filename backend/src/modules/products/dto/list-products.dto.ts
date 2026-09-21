import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../products.constants.js';

/** Filtro de status do painel. `all` e o padrao: a dona quer ver tudo. */
export const PRODUCT_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;

export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

/** Busca da listagem do painel. Tudo opcional, tudo combinavel. */
export class ListProductsDto {
  /** Busca por nome e marca. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsMongoId({ message: 'categoria invalida' })
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_FILTERS, { message: 'status invalido' })
  status?: ProductStatusFilter;

  // `@Type` porque query string chega como texto e o ValidationPipe nao
  // converte sozinho: sem isso, `page=2` reprovaria no `@IsInt`.
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
