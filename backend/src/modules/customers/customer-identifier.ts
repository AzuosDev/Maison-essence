import type { QueryFilter } from 'mongoose';
import { normalizeBrazilianPhone } from '../orders/phone.js';
import type { Customer } from './schemas/customer.schema.js';

/**
 * Quem esta tentando entrar, lido do que foi digitado.
 *
 * ## A arroba decide antes do telefone
 *
 * `88@9` não e um número com pontuação estranha: e um e-mail mal digitado.
 * Tratar como telefone produziria uma recusa falando de DDD para quem errou o
 * domínio. Havendo arroba, só resta e-mail.
 *
 * ## A mesma regra dos dois lados
 *
 * O telefone passa por `normalizeBrazilianPhone`, a mesma função do checkout e
 * do cadastro. E obrigatório que seja a mesma: duas regras produziriam um
 * login que aceita um número que o cadastro recusa, ou pior, que procura
 * `88999999999` onde esta gravado `5588999999999`.
 *
 * O e-mail e minusculado aqui porque o cadastro grava minusculo — quem digita
 * `Felipe@Gmail.com` no celular, com a primeira letra que o teclado
 * maiusculiza sozinho, precisa entrar.
 */

export type CustomerIdentifier =
  | { kind: 'phone'; phone: string }
  | { kind: 'email'; email: string };

/** Formato mínimo de e-mail. A validação séria e a do cadastro. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LENGTH = 160;

export function resolveCustomerIdentifier(value: unknown): CustomerIdentifier | null {
  if (typeof value !== 'string') {
    return null;
  }

  const typed = value.trim();

  if (typed.includes('@')) {
    const email = typed.toLowerCase();

    return EMAIL_SHAPE.test(email) && email.length <= MAX_EMAIL_LENGTH
      ? { kind: 'email', email }
      : null;
  }

  const phone = normalizeBrazilianPhone(typed);

  return phone === null ? null : { kind: 'phone', phone };
}

/**
 * O filtro que acha a conta.
 *
 * Uma função e não dois `findOne` espalhados: o login, a recuperação de senha
 * e o que vier depois precisam procurar do mesmo jeito, e o dia em que um
 * deles procurar diferente e o dia em que uma conta entra por uma porta e não
 * pela outra.
 */
export function customerFilterFor(identity: CustomerIdentifier): QueryFilter<Customer> {
  return identity.kind === 'phone' ? { phone: identity.phone } : { email: identity.email };
}
