import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CardPlan } from '../../../common/enums/card-plan.js';
import { CARD_PLAN_VALUES } from '../../../common/enums/card-plan.js';
import type { PixKeyType } from '../../../common/enums/payment-method.js';
import { PIX_KEY_TYPE_VALUES } from '../../../common/enums/payment-method.js';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import {
  MAX_CARD_FEE_PERCENT,
  MAX_INSTALLMENTS,
  MAX_PIX_DISCOUNT_PERCENT,
  MAX_PIX_KEY_LENGTH,
} from '../payments.constants.js';

/**
 * Uma linha da tabela de taxas: a quantidade de parcelas e o que a operadora
 * cobra por ela em cada modalidade.
 *
 * As duas taxas são obrigatórias. Aceitar uma linha pela metade significaria
 * decidir, aqui, o que fazer com a modalidade que ficou vazia — e as duas
 * respostas possíveis são ruins: zero faz a loja vender sem repassar a taxa,
 * e omitir faz a parcela sumir só de um lado. O painel manda a tabela inteira,
 * com as duas colunas, e uma célula em branco e erro de formulário.
 */
export class CardRateDto {
  @IsInt({ message: 'a quantidade de parcelas deve ser um número inteiro' })
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  installments: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'a taxa do link aceita até duas casas' })
  @Min(0)
  @Max(MAX_CARD_FEE_PERCENT)
  linkPercent: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'a taxa da maquininha aceita até duas casas' })
  @Min(0)
  @Max(MAX_CARD_FEE_PERCENT)
  tapPercent: number;
}

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
   * Até aqui a loja absorve a taxa. Não pode passar de `maxInstallments` — a
   * regra vale também para o seed e para um script, e por isso mora no schema,
   * que a recusa com 422.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  interestFreeUpTo?: number;

  /**
   * A tabela de taxas inteira, quando ela muda.
   *
   * Substitui a que esta gravada, em vez de casar linha por linha. Uma taxa
   * reajustada vem no meio de uma tabela que a dona acabou de conferir inteira
   * na tela, e mandar só a linha mexida obrigaria o servidor a adivinhar o que
   * fazer com uma parcela que sumiu do formulário: apagar ou manter. O
   * documento tem doze linhas; mandá-las todas custa nada.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INSTALLMENTS, {
    message: `a tabela de taxas tem no máximo ${MAX_INSTALLMENTS} linhas`,
  })
  @ValidateNested({ each: true })
  @Type(() => CardRateDto)
  cardRates?: CardRateDto[];

  /** A tabela do plano Nitro, nas mesmas regras. Vazia e um estado valido. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INSTALLMENTS, {
    message: `a tabela de taxas tem no máximo ${MAX_INSTALLMENTS} linhas`,
  })
  @ValidateNested({ each: true })
  @Type(() => CardRateDto)
  nitroCardRates?: CardRateDto[];

  /**
   * Qual das duas tabelas passa a valer no checkout.
   *
   * Ativar o Nitro com a tabela dele vazia e recusado no schema, com 422, e
   * não aqui: a regra depende da tabela que esta gravada — ou que vem nesta
   * mesma requisição —, e um decorator de campo não enxerga o par.
   */
  @IsOptional()
  @IsIn(CARD_PLAN_VALUES, { message: 'plano da operadora inválido' })
  activeCardPlan?: CardPlan;

  /** Abaixo disto a opção de parcelamento não e oferecida. */
  @IsOptional()
  @IsInt({ message: 'a parcela mínima deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  minInstallmentCents?: number;
}
