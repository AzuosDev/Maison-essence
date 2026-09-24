import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_ADDRESSES } from '../customers.constants.js';

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Tira o que não e digito e devolve `00000-000`. CEP vazio continua vazio. */
const toZipCode = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const digits = value.replace(/\D/g, '');

  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
};

/**
 * Um endereço salvo na conta.
 *
 * `id` presente identifica um endereço que já existe — e o que permite
 * corrigir o número da casa sem o endereço trocar de identidade. Ausente, e
 * endereço novo e ganha o seu. Mesmo desenho dos banners da loja, pelo mesmo
 * motivo: a lista chega inteira e precisa ser casada com a que esta gravada.
 */
export class CustomerAddressDto {
  @IsOptional()
  @IsMongoId({ message: 'endereço inválido' })
  id?: string;

  /** "Casa", "Trabalho". */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  label?: string;

  /**
   * Cidade atendida pela loja. Conferida no serviço, contra as cidades
   * cadastradas: endereço apontando para cidade que a loja não atende e uma
   * entrega que só falha no fechamento do pedido.
   */
  @IsOptional()
  @IsMongoId({ message: 'cidade inválida' })
  cityId?: string;

  @Transform(trimmed)
  @IsString({ message: 'informe a rua' })
  @MinLength(3, { message: 'informe a rua' })
  @MaxLength(160)
  street: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  complement?: string;

  @Transform(trimmed)
  @IsString({ message: 'informe o bairro' })
  @MinLength(2, { message: 'informe o bairro' })
  @MaxLength(80)
  district: string;

  @IsOptional()
  @Transform(toZipCode)
  @Matches(/^(?:\d{5}-\d{3})?$/, { message: 'CEP inválido' })
  zipCode?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(200)
  reference?: string;

  /** O endereço que o checkout preenche sozinho. Só um fica marcado. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Edição da própria conta.
 *
 * Não há telefone aqui de propósito. Ele e a chave que liga a conta aos
 * pedidos — inclusive aos que foram feitos como convidado — e deixar o cliente
 * troca-lo sozinho significaria uma conta herdando o histórico de outra
 * pessoa, ou perdendo o próprio. Troca de número e conversa com a loja.
 *
 * Senha também não: trocar senha derruba sessão e pede a senha atual, o que e
 * outra rota e outro fluxo.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(2, { message: 'informe seu nome' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsEmail({}, { message: 'informe um e-mail válido' })
  @MaxLength(160)
  email?: string;

  /**
   * A lista inteira substitui a gravada. Ausente, não mexe nos endereços:
   * corrigir o nome não pode apagar onde a pessoa mora.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADDRESSES, {
    message: `a conta guarda no máximo ${MAX_ADDRESSES} enderecos`,
  })
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses?: CustomerAddressDto[];
}
