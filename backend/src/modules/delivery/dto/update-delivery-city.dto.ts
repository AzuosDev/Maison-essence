import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { MAX_DELIVERY_CITY_ORDER, MAX_ESTIMATED_DAYS } from '../delivery.constants.js';

/**
 * Edicao de uma cidade. Todo campo e opcional: o painel manda so o que mudou.
 *
 * `isActive: false` e o caminho normal para parar de atender uma cidade —
 * ela some da lista publica na hora, e os pedidos antigos continuam legiveis
 * porque guardaram nome e taxa em copia propria.
 */
export class UpdateDeliveryCityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2, { message: 'o estado e a sigla de duas letras, como CE' })
  state?: string;

  @IsOptional()
  @IsInt({ message: 'a taxa deve ser um inteiro em centavos — R$ 15,00 se escreve 1500' })
  @Min(0)
  @Max(MAX_CENTS)
  feeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_ESTIMATED_DAYS)
  estimatedDays?: number;

  /** `null` devolve a cidade a regra global da loja. */
  @IsOptional()
  @IsInt({ message: 'o mínimo para frete grátis deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  minOrderForFreeCents?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_DELIVERY_CITY_ORDER)
  order?: number;
}
