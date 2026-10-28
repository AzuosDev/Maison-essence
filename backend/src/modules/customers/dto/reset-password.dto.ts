import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CUSTOMER_PASSWORD_MIN_LENGTH, RESET_TOKEN_PATTERN } from '../customers.constants.js';

/**
 * A nova senha, apresentando o token que chegou por e-mail.
 *
 * O formato do token e conferido aqui, e isso tem efeito prático: o que não
 * tem a cara de um token sorteado por nós e recusado com 400 antes de
 * qualquer consulta ao banco. Quem tentar adivinhar não consegue usar esta
 * rota como relógio para medir quais tokens existem.
 */
export class ResetPasswordDto {
  @IsString({ message: 'link inválido' })
  @Matches(RESET_TOKEN_PATTERN, { message: 'link inválido' })
  token: string;

  @IsString({ message: 'informe a nova senha' })
  @MinLength(CUSTOMER_PASSWORD_MIN_LENGTH, {
    message: `a senha deve ter ao menos ${CUSTOMER_PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128)
  password: string;
}
