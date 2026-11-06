import { IsBoolean, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { MAX_GIFT_LABEL_LENGTH } from '../settings.constants.js';

/**
 * O brinde por valor de compra.
 *
 * Fusão campo a campo, como o endereço de retirada: a tela manda só o que a
 * dona mexeu, e trocar o valor meta não pode apagar a frase do balão.
 *
 * Nenhum campo e obrigatório e nenhuma combinação e recusada aqui. Brinde
 * ligado sem valor e configuração pela metade, não corpo inválido — e o que a
 * dona tem enquanto escolhe o produto, e um 422 no meio disso a faria perder o
 * que já tinha digitado. Quem decide se o brinde esta de pé e `liveGift`, na
 * hora de mostrar; o painel avisa antes, em texto.
 */
export class GiftDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * O subtotal que libera o brinde, em centavos. `null` tira o valor meta.
   *
   * Medido contra o subtotal dos produtos, que e o mesmo número que a régua da
   * sacola persegue — e não contra o total, que ainda ganha frete e desconto
   * do PIX depois.
   */
  @IsOptional()
  @IsInt({ message: 'o valor do brinde deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  minCents?: number | null;

  /** O produto que a cliente ganha. `null` deixa o brinde sem foto. */
  @IsOptional()
  @IsMongoId({ message: 'informe o id de um produto válido' })
  productId?: string | null;

  /** A frase que completa "Compre R$ 179,99 e ganhe ___". */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GIFT_LABEL_LENGTH)
  label?: string;
}
