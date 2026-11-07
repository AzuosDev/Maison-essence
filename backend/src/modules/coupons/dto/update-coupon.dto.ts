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

/**
 * Edição do cupom. Todo campo e opcional: o painel manda só o que mudou.
 *
 * ## O que não se edita
 *
 * `usedCount` não esta aqui, e nunca estará. O contador e consequência de
 * venda fechada, não configuração — um campo editável ali seria a possibilidade
 * de "corrigir" para 0 um cupom que já deu cinquenta descontos. Quem precisa
 * de mais usos aumenta o `maxUses`, que e a decisão que ela de fato quis tomar.
 *
 * `slug` também não: o endereço da campanha já circulou, e trocar o nome não
 * pode quebrar o `/promocao/black-friday` que foi para o story.
 *
 * ## Trocar de tipo de desconto
 *
 * Passar de 20% para R$ 30 e mandar `percentOff: null` e `amountOffCents:
 * 3000` na mesma chamada. Mandar só o segundo e recusado pelo schema, com a
 * frase de `ONE_DISCOUNT_MESSAGE` — que e a verdade sobre o que foi pedido:
 * dois descontos no mesmo cupom.
 */
export class UpdateCouponDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(MIN_COUPON_CODE_LENGTH)
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  @Matches(COUPON_CODE_PATTERN, {
    message: 'o código deve ter só letras e números, sem espaço e sem acento',
  })
  code?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(MAX_COUPON_TITLE_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_COUPON_TAGLINE_LENGTH)
  tagline?: string;

  /** `null` tira o percentual — use junto do valor em reais que entra no lugar. */
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

  /** `null` tira o teto: o cupom passa a valer sem limite de usos. */
  @IsOptional()
  @IsInt({ message: 'o limite de usos deve ser um número inteiro' })
  @Min(1)
  @Max(MAX_COUPON_USES)
  maxUses?: number | null;

  /** `null` abre a ponta: "desde sempre" no início, "até segunda ordem" no fim. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de início inválida' })
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de término inválida' })
  endsAt?: Date | null;

  /** Lista vazia devolve o cupom a loja inteira. */
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
