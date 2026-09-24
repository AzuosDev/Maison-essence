/**
 * O que a API devolve nas duas sessões.
 *
 * São espelhos de `auth.types.ts` e `customer.view.ts` do backend, escritos a
 * mão porque as duas pastas são projetos separados — não há import
 * atravessando o monorepo, e não deve haver: o frontend consome a API
 * publicada, não o código dela.
 *
 * Em troca, estes tipos precisam ser conferidos quando o contrato mudar. São
 * poucos campos, e são os que quebram a tela na hora se divergirem.
 */

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Quem opera o painel. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Senha temporária: o painel manda trocar antes de liberar o resto. */
  mustChangePassword: boolean;
  credentialVersion: number;
  lastLoginAt: string | null;
}

/** Endereço salvo na conta do cliente. */
export interface CustomerAddress {
  id: string;
  label: string;
  cityId: string | null;
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
  isDefault: boolean;
}

/**
 * Quem compra. Não tem papel nenhum, e a ausência e proposital: não existe
 * campo aqui que o controle de acesso do painel saiba ler.
 */
export interface Customer {
  id: string;
  name: string;
  /** Só digitos, como esta gravado. E a chave que liga a conta aos pedidos. */
  phone: string;
  /** `(88) 99999-9999`, já pronto pela API. */
  phoneLabel: string;
  email: string;
  addresses: CustomerAddress[];
  createdAt: string;
}

/** O corpo de `POST /auth/login` e `POST /auth/refresh`. */
export interface AdminSessionResponse {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token em segundos. */
  expiresIn: number;
  tokenType: 'Bearer';
  user: AdminUser;
}

/** O corpo de `POST /customer/login`, `/customer/register` e `/customer/refresh`. */
export interface CustomerSessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  customer: Customer;
}
