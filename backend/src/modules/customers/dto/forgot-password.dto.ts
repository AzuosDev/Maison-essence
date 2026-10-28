import { Validate } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { ValidatorConstraint } from 'class-validator';
import { resolveCustomerIdentifier } from '../customer-identifier.js';
import { IDENTIFIER_MESSAGE } from './login-customer.dto.js';

@ValidatorConstraint({ name: 'forgotPasswordIdentifier' })
class ForgotIdentifierRule implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return resolveCustomerIdentifier(value) !== null;
  }

  defaultMessage(): string {
    return IDENTIFIER_MESSAGE;
  }
}

/**
 * "Esqueci minha senha": o mesmo campo do login.
 *
 * Aceitar celular aqui, e não só e-mail, não e conveniência: o telefone e o
 * que esta pessoa sabe de cor, porque e o que ela digita em todo pedido. O
 * e-mail da conta e justamente o que ela pode não lembrar — e e para lá que a
 * mensagem vai de qualquer jeito.
 */
export class ForgotPasswordDto {
  @Validate(ForgotIdentifierRule)
  identifier: string;
}
