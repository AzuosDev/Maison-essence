import type { CustomerDocument } from './schemas/customer.schema.js';

/**
 * Cliente autenticado, como o guard o anexa ao request.
 *
 * Não há papel nenhum aqui, e não e esquecimento: não existe campo neste tipo
 * que o `RolesGuard` possa ler como permissão. Uma conta de loja que virasse
 * acesso de painel teria de inventar um dado que este objeto não carrega.
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
