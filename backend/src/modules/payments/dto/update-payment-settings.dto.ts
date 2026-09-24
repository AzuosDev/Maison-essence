import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PixKeyType } from '../../../common/enums/payment-method.js';
import { PIX_KEY_TYPE_VALUES } from '../../../common/enums/payment-method.js';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import {
  MAX_INSTALLMENTS,
  MAX_MONTHLY_INTEREST_PERCENT,
  MAX_PIX_DISCOUNT_PERCENT,
  MAX_PIX_KEY_LENGTH,
} from '../payments.constants.js';

/**
 * Edição das regras de pagamento. Campo omitido fica como esta.
 *
 * A chave PIX não e validada aqui e sim no serviço: ela só faz sentido junto
 * do `pixKeyType`, que pode estar chegando nesta mesma requisição ou já estar
 * gravado, e um decorator de campo não enxerga o par. Ver `pix-key.ts`.
 */
export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  acceptsPix?: boolean;

  /** Vazio remove a chave e tira o PIX do ar mesmo com a opção ligada. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PIX_KEY_LENGTH)
  pixKey?: string;

  @IsOptional()
  @IsIn(PIX_KEY_TYPE_VALUES, { message: 'tipo de chave PIX inválido' })
  pixKeyType?: PixKeyType;

  /** Desconto sobre o subtotal de produtos. Nunca sobre a entrega. */
  @IsOptional()
  @IsInt({ message: 'o desconto do PIX deve ser um percentual inteiro' })
  @Min(0)
  @Max(MAX_PIX_DISCOUNT_PERCENT)
  pixDiscountPercent?: number;

  @IsOptional()
  @IsBoolean()
  acceptsCard?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  maxInstallments?: number;

  /**
   * Até aqui o total e dividido sem juros. Não pode passar de
   * `maxInstallments` — a regra vale também para o seed e para um script, e
   * por isso mora no schema, que a recusa com 422.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  interestFreeUpTo?: number;

  /**
   * Juros ao mês. Aceita fração de propósito: 1,99% ao mês e o que a
   * maquininha cobra, e arredondar para 2% muda a última parcela.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'os juros ao mês aceitam até duas casas' })
  @Min(0)
  @Max(MAX_MONTHLY_INTEREST_PERCENT)
  monthlyInterestPercent?: number;

  /** Abaixo disto a opção de parcelamento não e oferecida. */
  @IsOptional()
  @IsInt({ message: 'a parcela mínima deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  minInstallmentCents?: number;
}
