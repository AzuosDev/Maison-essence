import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { MAX_SKU_LENGTH } from '../sku.js';
import { MAX_STOCK } from '../products.constants.js';

/**
 * Uma variante dentro do array que o POST e o PATCH recebem.
 *
 * `id` presente identifica variante que ja existe; ausente, o servidor cria.
 * O painel manda o array inteiro nas duas rotas e nao precisa saber o que
 * mudou — quem descobre e o diff, em `variants.diff.ts`.
 */
export class ProductVariantDto {
  @IsOptional()
  @IsMongoId({ message: 'variante invalida' })
  id?: string;

  /** Sem SKU, o servidor gera um a partir do nome do produto e do label. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(MAX_SKU_LENGTH)
  sku?: string;

  /** `100 ml`, `Asad Elixir`. Vazio no produto simples. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsInt({ message: 'o preco deve ser um inteiro em centavos: R$ 199,90 se escreve 19990' })
  @Min(0)
  @Max(MAX_CENTS)
  priceCents: number;

  /** Preco "de", riscado no card. `null` tira o desconto da variante. */
  @IsOptional()
  @IsInt({ message: 'o preco de comparacao deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  compareAtPriceCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stock?: number;

  /** `publicId` do Cloudinary. Quando existe, substitui a capa do produto. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Deixa vender com estoque zerado, para o que a dona encomenda sob demanda. */
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;
}
