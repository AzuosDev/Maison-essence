import { IsString, MaxLength, MinLength } from 'class-validator';
import { CUSTOMER_PASSWORD_MIN_LENGTH } from '../customers.constants.js';

/**
 * Troca de senha de quem já esta dentro.
 *
 * A senha atual e exigida mesmo havendo sessão valida, e não e redundância:
 * sessão aberta e celular emprestado, aba esquecida no computador da loja,
 * token roubado. Pedir a senha atual e o que separa "tem acesso agora" de "e o
 * dono da conta" — e trocar a senha e justamente o que tiraria o dono de
 * dentro dela.
 *
 * Sem mínimo na atual: ali não se cadastra senha, se confere uma. Exigir oito
 * caracteres no campo da senha antiga contaria a quem tentasse adivinhar que
 * as senhas desta loja têm pelo menos oito.
 */
export class ChangeCustomerPasswordDto {
  @IsString({ message: 'informe sua senha atual' })
  @MaxLength(128)
  currentPassword: string;

  @IsString({ message: 'informe a nova senha' })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `a senha deve ter ao menos ${CUSTOMER_PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128)
  newPassword: string;
}
