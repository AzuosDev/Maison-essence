import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { FULFILLMENT_MODES } from '../../../common/enums/fulfillment-mode.js';
import { QuoteCartDto } from '../../cart/dto/quote-cart.dto.js';
import { IsBrazilianPhone } from '../phone.js';

/** Tira o que nao e digito e devolve `00000-000`. CEP vazio continua vazio. */
const toZipCode = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const digits = value.replace(/\D/g, '');

  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
};

/** Quem esta comprando. Nome e telefone bastam: o checkout e como convidado. */
export class OrderCustomerDto {
  @IsString({ message: 'informe seu nome' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2, { message: 'informe seu nome' })
  @MaxLength(120)
  name: string;

  @IsBrazilianPhone()
  phone: string;

  /** Opcional de verdade: a loja atende pelo WhatsApp, nao por e-mail. */
  @IsOptional()
  @IsEmail({}, { message: 'e-mail inválido' })
  @MaxLength(160)
  email?: string;
}

/**
 * Para onde entregar.
 *
 * Rua e bairro sao obrigatorios; numero nao, porque endereco sem numero
 * existe e "s/n" e resposta legitima em cidade do interior. O ponto de
 * referencia vale mais que o CEP na hora de achar a casa, e por isso tem
 * espaco proprio em vez de ser espremido no complemento.
 */
export class OrderAddressDto {
  @IsString({ message: 'informe a rua' })
  @MinLength(3, { message: 'informe a rua' })
  @MaxLength(160)
  street: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string;

  @IsString({ message: 'informe o bairro' })
  @MinLength(2, { message: 'informe o bairro' })
  @MaxLength(80)
  district: string;

  @IsOptional()
  @Transform(toZipCode)
  @Matches(/^(?:\d{5}-\d{3})?$/, { message: 'CEP inválido' })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}

/**
 * O corpo de `POST /orders`: a mesma sacola da cotacao, mais quem compra.
 *
 * Herda de `QuoteCartDto` de proposito, e nao repete os campos: sao os mesmos
 * itens, a mesma entrega e o mesmo pagamento, validados pelas mesmas regras.
 * Duas declaracoes da mesma sacola divergiriam no dia em que uma delas
 * ganhasse um campo.
 */
export class CreateOrderDto extends QuoteCartDto {
  @IsDefined({ message: 'informe seus dados de contato' })
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto;

  /**
   * Obrigatorio na entrega, ignorado na retirada.
   *
   * `@ValidateIf` em vez de checagem no servico porque isto e forma do corpo,
   * nao regra de negocio: quem pede entrega sem endereco errou o formulario, e
   * a resposta certa e 400 com o campo que faltou.
   */
  @ValidateIf((dto: CreateOrderDto) => dto.fulfillment?.mode === FULFILLMENT_MODES.DELIVERY)
  @IsDefined({ message: 'informe o endereço de entrega' })
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto;

  /**
   * O total que o cliente viu na tela, em centavos.
   *
   * Nao entra em conta nenhuma: e conferencia. O servidor refaz a cotacao
   * inteira e compara — se o preco subiu, o desconto venceu ou o estoque
   * acabou entre montar a sacola e fechar o pedido, a diferenca aparece aqui e
   * o pedido volta em 409 com a cotacao nova, em vez de ser gravado por um
   * valor que ninguem combinou.
   *
   * Obrigatorio para que essa conferencia nunca seja pulada por omissao.
   */
  @IsDefined({ message: 'informe o total que aparece na sacola' })
  @IsInt({ message: 'total inválido' })
  @Min(0)
  @Max(MAX_CENTS)
  expectedTotalCents: number;
}
