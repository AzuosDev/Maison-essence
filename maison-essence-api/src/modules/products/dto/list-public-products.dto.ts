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
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { MAX_SLUG_LENGTH } from '../../../database/slug.js';
import { PUBLIC_SORTS } from '../catalog.query.js';
import type { PublicSort } from '../catalog.query.js';
import { MAX_PUBLIC_PAGE_SIZE, PUBLIC_PAGE_SIZE } from '../products.constants.js';

/**
 * Bandeira vinda da query string.
 *
 * `?inStock` sem valor, `?inStock=true` e `?inStock=1` querem dizer a mesma
 * coisa — o link vem do filtro da vitrine, e cada biblioteca de front monta
 * de um jeito. Sem isso, `@IsBoolean` reprovaria o texto `"true"`.
 */
const QueryFlag = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === 'true' || value === '1') {
      return true;
    }

    if (value === 'false' || value === '0') {
      return false;
    }

    return value;
  });

/** Filtros da vitrine. Tudo opcional, tudo combinavel. */
export class ListPublicProductsDto {
  /** Slug da categoria. As subcategorias dela entram junto. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  category?: string;

  /** Busca por nome e marca. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  // Em centavos, como todo dinheiro nesta API. O filtro de faixa de preco da
  // vitrine e um slider que ja trabalha com o mesmo numero do card.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preco minimo invalido' })
  @Min(0)
  @Max(MAX_CENTS)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preco maximo invalido' })
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

  /** Sem `sort`, a vitrine ordena por relevancia se ha busca e por novidade se nao ha. */
  @IsOptional()
  @IsIn(PUBLIC_SORTS, { message: 'ordenacao invalida' })
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
    message: `a vitrine devolve no maximo ${MAX_PUBLIC_PAGE_SIZE} produtos por pagina`,
  })
  limit?: number = PUBLIC_PAGE_SIZE;
}
