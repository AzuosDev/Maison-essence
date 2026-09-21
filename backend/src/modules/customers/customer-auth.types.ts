import type { CustomerDocument } from './schemas/customer.schema.js';

/**
 * Cliente autenticado, como o guard o anexa ao request.
 *
 * Nao ha papel nenhum aqui, e nao e esquecimento: nao existe campo neste tipo
 * que o `RolesGuard` possa ler como permissao. Uma conta de loja que virasse
 * acesso de painel teria de inventar um dado que este objeto nao carrega.
 */
export interface AuthenticatedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  isActive: boolean;
  credentialVersion: number;
}

export function toAuthenticatedCustomer(
  customer: CustomerDocument,
): AuthenticatedCustomer {
  return {
    id: customer._id.toHexString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    isActive: customer.isActive,
    credentialVersion: customer.credentialVersion,
  };
}
