import { formatBrazilianPhone } from '../orders/phone.js';
import type { CustomerAddress, CustomerDocument } from './schemas/customer.schema.js';

/** Endereço salvo, como a loja o exibe. */
export interface CustomerAddressView {
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
 * A conta como quem comprou a vê.
 *
 * Montada campo a campo, e não devolvendo o documento: e o que garante que
 * `passwordHash` e `credentialVersion` nunca cheguem perto da resposta por
 * descuido, do mesmo jeito que `toAuthenticatedUser` faz no painel.
 */
export interface CustomerView {
  id: string;
  name: string;
  /** Só digitos, como esta gravado: e a chave que liga a conta aos pedidos. */
  phone: string;
  /** `(88) 99999-9999`. Acrescimo para a tela, nunca substituição. */
  phoneLabel: string;
  email: string;
  addresses: CustomerAddressView[];
  createdAt: Date;
}

/** Sessão da loja. Mesmo formato do painel, sem nada que lembre papel. */
export interface CustomerSession {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token em segundos, para o front agendar a renovação. */
  expiresIn: number;
  tokenType: 'Bearer';
  customer: CustomerView;
}

export function toCustomerView(customer: CustomerDocument): CustomerView {
  return {
    id: customer._id.toHexString(),
    name: customer.name,
    phone: customer.phone,
    phoneLabel: formatBrazilianPhone(customer.phone),
    email: customer.email,
    addresses: customer.addresses.map(toCustomerAddressView),
    createdAt: customer.createdAt,
  };
}

export function toCustomerAddressView(address: CustomerAddress): CustomerAddressView {
  return {
    id: address.id,
    label: address.label,
    cityId: address.cityId?.toHexString() ?? null,
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    zipCode: address.zipCode,
    reference: address.reference,
    isDefault: address.isDefault,
  };
}
