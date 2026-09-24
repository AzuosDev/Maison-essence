import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueryFlag } from '../../../common/query-flag.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../products.constants.js';

/** Filtro de status do painel. `all` e o padrão: a dona quer ver tudo. */
export const PRODUCT_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;

export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

/** Busca da listagem do painel. Tudo opcional, tudo combinável. */
export class ListProductsDto {
  /** Busca por nome e marca. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsMongoId({ message: 'categoria inválida' })
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_FILTERS, { message: 'status inválido' })
  status?: ProductStatusFilter;

  /**
   * Só o que esta em pronta entrega, ou só o que não esta.
   *
   * A pronta entrega e a prateleira física da loja, e a seção que mais vende
   * no local. Conferir o que esta nela pede a lista já recortada, e não mais
   * um filtro para marcar dentro de uma listagem de duzentos produtos.
   */
  @IsOptional()
  @QueryFlag()
  @IsBoolean({ message: 'filtro de pronta entrega inválido' })
  readyToShip?: boolean;

  // `@Type` porque query string chega como texto e o ValidationPipe não
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
