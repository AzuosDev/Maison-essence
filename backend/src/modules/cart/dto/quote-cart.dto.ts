import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsDefined,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_COUPON_CODE_LENGTH } from '../../coupons/coupons.constants.js';
import { CARD_MODE_VALUES } from '../../../common/enums/card-mode.js';
import type { CardMode } from '../../../common/enums/card-mode.js';
import { FULFILLMENT_MODE_VALUES } from '../../../common/enums/fulfillment-mode.js';
import type { FulfillmentMode } from '../../../common/enums/fulfillment-mode.js';
import { PAYMENT_METHOD_VALUES } from '../../../common/enums/payment-method.js';
import type { PaymentMethod } from '../../../common/enums/payment-method.js';
import { MAX_INSTALLMENTS } from '../../payments/payments.constants.js';
import { MAX_LINE_QUANTITY, MAX_QUOTE_ITEMS } from '../cart.constants.js';

/**
 * Uma linha da sacola, como o servidor a aceita: dois ids e uma quantidade.
 *
 * Não há campo de preço, e a ausência e o ponto. O carrinho do navegador
 * guarda nome, foto e valor para desenhar a tela, e o checkout manda o
 * carrinho inteiro — o que vier além destes três campos e descartado antes de
 * chegar ao serviço, em `cart.controller.ts`. Preço do cliente não tem onde
 * pousar nesta API.
 */
export class QuoteItemDto {
  @IsMongoId({ message: 'produto inválido' })
  productId: string;

  @IsMongoId({ message: 'variante inválida' })
  variantId: string;

  @IsInt({ message: 'a quantidade deve ser um número inteiro' })
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}

/** Como o pedido chega ao cliente. A cidade só existe na entrega. */
export class QuoteFulfillmentDto {
  @IsIn(FULFILLMENT_MODE_VALUES, { message: 'modo de entrega inválido' })
  mode: FulfillmentMode;

  /**
   * Opcional aqui, obrigatório lá: quem exige a cidade na entrega e o
   * `DeliveryService`, que e quem sabe se ela ainda e atendida. O DTO só
   * confere o formato.
   */
  @IsOptional()
  @IsMongoId({ message: 'cidade inválida' })
  cityId?: string;
}

/** A forma de pagamento escolhida e, no cartão, por onde e em quantas vezes. */
export class QuotePaymentDto {
  @IsIn(PAYMENT_METHOD_VALUES, { message: 'forma de pagamento inválida' })
  method: PaymentMethod;

  /**
   * Por onde o cartão vai ser cobrado. Opcional **nesta rota**, e só nela.
   *
   * O checkout precisa cotar antes de o cliente escolher a modalidade: ele
   * mostra o total do pedido e só então pergunta por onde o cartão vai. Sem
   * modalidade a cotação volta sem parcelas — a tabela de taxas e por
   * modalidade, e não ha como calcular parcela sem saber qual coluna vale.
   *
   * Fechar o pedido sem ela, esse não da: quem recusa e `assertQuoteHolds`,
   * na criação, com 422.
   */
  @IsOptional()
  @IsIn(CARD_MODE_VALUES, { message: 'modalidade de cartão inválida' })
  cardMode?: CardMode;

  /** Sem parcelamento informado, a cotação sai a vista. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  installments?: number = 1;
}

/** O corpo de `POST /cart/quote`. Tudo que o servidor precisa, e nada mais. */
export class QuoteCartDto {
  @ArrayNotEmpty({ message: 'a sacola esta vazia' })
  @ArrayMaxSize(MAX_QUOTE_ITEMS, {
    message: `a cotação aceita no máximo ${MAX_QUOTE_ITEMS} itens`,
  })
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  @IsDefined({ message: 'informe o modo de entrega' })
  @ValidateNested()
  @Type(() => QuoteFulfillmentDto)
  fulfillment: QuoteFulfillmentDto;

  @IsDefined({ message: 'informe a forma de pagamento' })
  @ValidateNested()
  @Type(() => QuotePaymentDto)
  payment: QuotePaymentDto;

  /**
   * O código do cupom, como a cliente o digitou.
   *
   * Normalizado aqui — sem espaco, em maiúsculas — para que `blackfriday` e
   * ` BlackFriday ` cheguem ao banco como o mesmo cupom. Nenhum formato e
   * exigido além do tamanho: código inválido não e corpo inválido, e sim um
   * código que não existe, e a resposta certa para isso e a cotação completa
   * com um aviso — nunca um 400 que apaga a tela de quem errou uma letra.
   *
   * Ausente e o caso comum. O que ele **nunca** carrega e valor de desconto:
   * como no preço dos itens, o cliente diz *qual*, e o banco diz *quanto*.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'cupom inválido' })
  @MaxLength(MAX_COUPON_CODE_LENGTH, { message: 'cupom inválido' })
  couponCode?: string;
}
