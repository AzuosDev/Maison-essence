import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Endereco da retirada na loja.
 *
 * Todo campo e opcional e o PATCH funde o que chega com o que ja esta
 * gravado: a tela de configuracoes manda so o que a dona mexeu, e corrigir o
 * numero da casa nao pode apagar o ponto de referencia.
 */
export class PickupAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /** Sigla de duas letras. Aceita minuscula: o schema grava em maiuscula. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2, { message: 'o estado e a sigla de duas letras, como CE' })
  state?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?:\d{5}-?\d{3})?$/, { message: 'o CEP deve ter o formato 62000-000' })
  zipCode?: string;

  /** Ponto de referencia. Em cidade pequena vale mais que o CEP. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}
