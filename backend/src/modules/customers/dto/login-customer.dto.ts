import { IsString, MaxLength, Validate } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { ValidatorConstraint } from 'class-validator';
import { resolveCustomerIdentifier } from '../customer-identifier.js';

export const IDENTIFIER_MESSAGE =
  'informe o celular com DDD, como (88) 99999-9999, ou o e-mail da conta';

@ValidatorConstraint({ name: 'customerIdentifier' })
class CustomerIdentifierRule implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return resolveCustomerIdentifier(value) !== null;
  }

  defaultMessage(): string {
    return IDENTIFIER_MESSAGE;
  }
}

/**
 * Login da loja: celular ou e-mail, e a senha.
 *
 * ## Um campo para os dois
 *
 * O telefone e a chave natural desta loja — e o que o cliente informa no
 * checkout, o que a dona usa para responder no WhatsApp e o que liga o pedido
 * de convidado a conta. Mas o cadastro também pede e-mail, e um e-mail que a
 * conta guarda, a tela mostra e o login recusa e uma armadilha: a pessoa tenta
 * o que esta escrito em "Meus dados" e lê que a senha não confere.
 *
 * Por isso o campo e um só e aceita os dois formatos. Quem decide qual e qual
 * e `resolveCustomerIdentifier`, pela arroba, e não o servidor tentando as
 * duas consultas.
 *
 * ## Continua sendo um campo, e não dois
 *
 * `identifier` e não `phone?`/`email?` porque com dois campos opcionais existe
 * o corpo com os dois preenchidos, e aí alguma linha de código teria de
 * escolher qual vale. Um campo não tem esse estado.
 */
export class LoginCustomerDto {
  @Validate(CustomerIdentifierRule)
  identifier: string;

  @IsString({ message: 'informe sua senha' })
  @MaxLength(128)
  password: string;
}
