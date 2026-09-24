import type { CustomerAddress } from '@/features/auth';
import type { CustomerOrder, OrderStatus } from '@/features/checkout';

/**
 * O que a área do cliente troca com a API.
 *
 * Espelho de `customer.view.ts` e `order.view.ts` do backend, escrito a mão
 * como todos os outros contratos deste projeto: as duas pastas são projetos
 * separados, e o frontend consome a API publicada, não o código dela.
 *
 * Três tipos vem de outros módulos em vez de serem redeclarados aqui, e a
 * reutilização e o ponto:
 *
 * - `CustomerAddress` e `Customer` moram em `features/auth`, porque a conta
 *   inteira volta no corpo do login e do cadastro — quem os declarasse de
 *   novo aqui criaria duas versões do mesmo objeto para divergirem depois.
 * - `CustomerOrder` mora em `features/checkout`, e e **literalmente** o mesmo
 *   `CustomerOrderView` que `GET /customer/orders/:code` devolve: o backend
 *   reaproveita a projeção que o pedido já oferecia a quem o criou. A tela de
 *   detalhe e a de confirmação leem o mesmo objeto.
 */

/** A linha da lista de pedidos: o que cabe num cartão no celular. */
export interface CustomerOrderSummary {
  id: string;
  /** `ME-AAMMDD-XXXX`. E o que o cliente repete no WhatsApp. */
  code: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  phoneLabel: string;
  mode: 'delivery' | 'pickup';
  /** Quantas unidades, somando as linhas. Não e o número de linhas. */
  itemCount: number;
  totalCents: number;
  createdAt: string;
}

/** O detalhe, como `GET /customer/orders/:code` o devolve. */
export type CustomerOrderDetail = CustomerOrder;

/** Uma página de qualquer lista da API. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/** O endereço salvo, como a conta o guarda. */
export type AccountAddress = CustomerAddress;

/** O corpo de `POST /customer/register`. */
export interface RegisterInput {
  name: string;
  /** Onze digitos, já normalizados. O servidor valida de novo. */
  phone: string;
  email: string;
  password: string;
}

/** O corpo de `POST /customer/login`. */
export interface LoginInput {
  phone: string;
  password: string;
}

/**
 * O corpo de `PATCH /customer/me`.
 *
 * Não há telefone nem senha, e a ausência e do backend, não um recorte desta
 * tela: o telefone e a chave que liga a conta aos pedidos — inclusive aos
 * feitos como convidado — e troca-lo sozinho faria uma conta herdar o
 * histórico de outra pessoa.
 *
 * `addresses`, quando vem, **substitui a lista inteira**. Ausente, não mexe
 * nos endereços: corrigir o nome não pode apagar onde a pessoa mora. E a
 * única forma que a API oferece de remover um endereço, e e por isso que
 * toda ação da tela de endereços manda a lista completa.
 */
export interface UpdateProfileInput {
  name?: string;
  email?: string;
  addresses?: AddressInput[];
}

/**
 * Um endereço no corpo do `PATCH`.
 *
 * `id` presente identifica um endereço que já existe — e o que permite
 * corrigir o número da casa sem o endereço trocar de identidade. Ausente, e
 * endereço novo e ganha o seu no servidor.
 */
export interface AddressInput {
  id?: string;
  label: string;
  cityId?: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
  isDefault: boolean;
}

/** Quantos endereços a conta guarda. O mesmo teto do backend. */
export const MAX_ADDRESSES = 10;

/** A senha do cliente: oito, e não os doze do painel. */
export const PASSWORD_MIN_LENGTH = 8;

/** Quantos pedidos por página. O mesmo padrão do backend. */
export const ORDERS_PAGE_SIZE = 10;
