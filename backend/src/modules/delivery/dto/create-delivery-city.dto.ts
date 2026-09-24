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
 * Cadastro de uma cidade atendida.
 *
 * Não há CEP nem integração com os Correios: a dona escolhe as cidades para
 * onde leva e quanto cobra em cada uma. E o modelo que corresponde a como a
 * entrega acontece — moto própria em Sobral, transportadora para Fortaleza.
 */
export class CreateDeliveryCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Sigla de duas letras. Aceita minúscula: o schema grava em maiúscula. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2, { message: 'o estado e a sigla de duas letras, como CE' })
  state: string;

  /** Taxa em centavos. Zero e legitimo: e a cidade em que a loja não cobra. */
  @IsInt({ message: 'a taxa deve ser um inteiro em centavos — R$ 15,00 se escreve 1500' })
  @Min(0)
  @Max(MAX_CENTS)
  feeCents: number;

  /** Prazo em dias úteis. Zero e entrega no mesmo dia. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_ESTIMATED_DAYS)
  estimatedDays?: number;

  /**
   * Frete grátis nesta cidade a partir deste valor. `null` ou ausente deixa a
   * cidade sob a regra global da loja, que esta em `StoreSettings`.
   */
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
