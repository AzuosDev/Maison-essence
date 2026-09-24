import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueryFlag } from '../../../common/query-flag.js';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { MAX_SLUG_LENGTH } from '../../../database/slug.js';
import { PUBLIC_SORTS } from '../catalog.query.js';
import type { PublicSort } from '../catalog.query.js';
import {
  MAX_PUBLIC_PAGE_SIZE,
  PUBLIC_PAGE_SIZE,
} from '../products.constants.js';

/** Filtros da vitrine. Tudo opcional, tudo combinável. */
export class ListPublicProductsDto {
  /** Slug da categoria. As subcategorias dela entram junto. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  category?: string;

  /** Busca por nome e marca. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  // Em centavos, como todo dinheiro nesta API. O filtro de faixa de preço da
  // vitrine e um slider que já trabalha com o mesmo número do card.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preço mínimo inválido' })
  @Min(0)
  @Max(MAX_CENTS)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preço máximo inválido' })
  @Min(0)
  @Max(MAX_CENTS)
  maxPrice?: number;

  @IsOptional()
  @QueryFlag()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @QueryFlag()
  @IsBoolean()
  readyToShip?: boolean;

  @IsOptional()
  @QueryFlag()
  @IsBoolean()
  featured?: boolean;

  /** Sem `sort`, a vitrine ordena por relevância se há busca e por novidade se não há. */
  @IsOptional()
  @IsIn(PUBLIC_SORTS, { message: 'ordenação inválida' })
  sort?: PublicSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PUBLIC_PAGE_SIZE, {
    message: `a vitrine devolve no máximo ${MAX_PUBLIC_PAGE_SIZE} produtos por página`,
  })
  limit?: number = PUBLIC_PAGE_SIZE;
}
