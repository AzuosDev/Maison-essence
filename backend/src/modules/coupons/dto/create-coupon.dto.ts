import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDate,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import {
  COUPON_CODE_PATTERN,
  MAX_COUPON_CODE_LENGTH,
  MAX_COUPON_PERCENT,
  MAX_COUPON_PRODUCTS,
  MAX_COUPON_TAGLINE_LENGTH,
  MAX_COUPON_TITLE_LENGTH,
  MAX_COUPON_USES,
  MIN_COUPON_CODE_LENGTH,
  MIN_COUPON_PERCENT,
} from '../coupons.constants.js';

/** Maiúsculas e sem espaço, antes de qualquer validação. */
const toCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * O cupom novo.
 *
 * O tipo de desconto não e exigido aqui, e a ausência e deliberada: quem recusa
 * "os dois" e "nenhum" e o `pre('validate')` do schema, que e o mesmo caminho
 * por onde passa o PATCH. Duas implementações da mesma exclusividade — uma no
 * corpo, outra na gravação — divergiriam no dia em que só uma fosse corrigida,
 * e a que vale e sempre a do banco.
 */
export class CreateCouponDto {
  @Transform(toCode)
  @IsString({ message: 'informe o código do cupom' })
  @MinLength(MIN_COUPON_CODE_LENGTH)
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  @Matches(COUPON_CODE_PATTERN, {
    message: 'o código deve ter só letras e números, sem espaço e sem acento',
  })
  code: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'informe o nome da campanha' })
  @MinLength(2, { message: 'informe o nome da campanha' })
  @MaxLength(MAX_COUPON_TITLE_LENGTH)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_COUPON_TAGLINE_LENGTH)
  tagline?: string;

  @IsOptional()
  @IsInt({ message: 'o desconto percentual deve ser um número inteiro' })
  @Min(MIN_COUPON_PERCENT)
  @Max(MAX_COUPON_PERCENT)
  percentOff?: number | null;

  @IsOptional()
  @IsInt({ message: 'o desconto deve ser um inteiro em centavos' })
  @Min(1)
  @Max(MAX_CENTS)
  amountOffCents?: number | null;

  /** `null` e sem teto: o código que não acaba. */
  @IsOptional()
  @IsInt({ message: 'o limite de usos deve ser um número inteiro' })
  @Min(1)
  @Max(MAX_COUPON_USES)
  maxUses?: number | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de início inválida' })
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de término inválida' })
  endsAt?: Date | null;

  /** Vazia e a loja inteira. */
  @IsOptional()
  @ArrayMaxSize(MAX_COUPON_PRODUCTS, {
    message: `um cupom aponta no máximo ${String(MAX_COUPON_PRODUCTS)} produtos`,
  })
  @IsMongoId({ each: true, message: 'produto inválido na lista do cupom' })
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
