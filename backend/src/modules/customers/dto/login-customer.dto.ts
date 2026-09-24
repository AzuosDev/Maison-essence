import { IsString, MaxLength } from 'class-validator';
import { IsBrazilianPhone } from '../../orders/phone.js';

/**
 * Login da loja: telefone e senha.
 *
 * Pelo telefone, e não pelo e-mail, porque o telefone e a chave natural desta
 * loja — e o que o cliente informa no checkout, o que a dona usa para
 * responder no WhatsApp e o que liga o pedido de convidado a conta. Entrar
 * por e-mail obrigaria o cliente a lembrar qual dos dois ele cadastrou.
 */
export class LoginCustomerDto {
  @IsBrazilianPhone()
  phone: string;

  @IsString({ message: 'informe sua senha' })
  @MaxLength(128)
  password: string;
}
