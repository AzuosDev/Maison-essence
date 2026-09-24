import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsBrazilianPhone } from '../../orders/phone.js';
import { CUSTOMER_PASSWORD_MIN_LENGTH } from '../customers.constants.js';

/** Tira os espaços das pontas do que a pessoa digitou. */
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Cadastro de cliente: nome, telefone, e-mail e senha.
 *
 * O telefone passa pela mesma normalização do checkout — e obrigatório que
 * seja a mesma, porque e por este número que os pedidos feitos como convidado
 * encontram a conta depois. Duas regras de telefone significariam
 * `88999999999` na conta e `5588999999999` no pedido, e um histórico que
 * nunca se junta.
 */
export class RegisterCustomerDto {
  @IsString({ message: 'informe seu nome' })
  @Transform(trimmed)
  @MinLength(2, { message: 'informe seu nome' })
  @MaxLength(120)
  name: string;

  @IsBrazilianPhone()
  phone: string;

  @Transform(trimmed)
  @IsEmail({}, { message: 'informe um e-mail válido' })
  @MaxLength(160)
  email: string;

  /**
   * Sem exigência de símbolo ou maiúscula, como no painel: o que segura força
   * bruta e comprimento, e regra de composição só produz senha anotada no
   * papel.
   */
  @IsString({ message: 'informe uma senha' })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `a senha deve ter ao menos ${CUSTOMER_PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128)
  password: string;
}
