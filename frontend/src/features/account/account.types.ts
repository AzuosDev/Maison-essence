import type { CustomerAddress } from '@/features/auth';
import type { CustomerOrder, OrderStatus } from '@/features/checkout';

/**
 * O que a area do cliente troca com a API.
 *
 * Espelho de `customer.view.ts` e `order.view.ts` do backend, escrito a mao
 * como todos os outros contratos deste projeto: as duas pastas sao projetos
 * separados, e o frontend consome a API publicada, nao o codigo dela.
 *
 * Tres tipos vem de outros modulos em vez de serem redeclarados aqui, e a
 * reutilizacao e o ponto:
 *
 * - `CustomerAddress` e `Customer` moram em `features/auth`, porque a conta
 *   inteira volta no corpo do login e do cadastro — quem os declarasse de
 *   novo aqui criaria duas versoes do mesmo objeto para divergirem depois.
 * - `CustomerOrder` mora em `features/checkout`, e e **literalmente** o mesmo
 *   `CustomerOrderView` que `GET /customer/orders/:code` devolve: o backend
 *   reaproveita a projecao que o pedido ja oferecia a quem o criou. A tela de
 *   detalhe e a de confirmacao leem o mesmo objeto.
 */

/** A linha da lista de pedidos: o que cabe num cartao no celular. */
export interface CustomerOrderSummary {
  id: string;
  /** `ME-AAMMDD-XXXX`. E o que o cliente repete no WhatsApp. */
  code: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  phoneLabel: string;
  mode: 'delivery' | 'pickup';
  /** Quantas unidades, somando as linhas. Nao e o numero de linhas. */
  itemCount: number;
  totalCents: number;
  createdAt: string;
}

/** O detalhe, como `GET /customer/orders/:code` o devolve. */
export type CustomerOrderDetail = CustomerOrder;

/** Uma pagina de qualquer lista da API. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/** O endereco salvo, como a conta o guarda. */
export type AccountAddress = CustomerAddress;

/** O corpo de `POST /customer/register`. */
export interface RegisterInput {
  name: string;
  /** Onze digitos, ja normalizados. O servidor valida de novo. */
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
 * Nao ha telefone nem senha, e a ausencia e do backend, nao um recorte desta
 * tela: o telefone e a chave que liga a conta aos pedidos — inclusive aos
 * feitos como convidado — e troca-lo sozinho faria uma conta herdar o
 * historico de outra pessoa.
 *
 * `addresses`, quando vem, **substitui a lista inteira**. Ausente, nao mexe
 * nos enderecos: corrigir o nome nao pode apagar onde a pessoa mora. E a
 * unica forma que a API oferece de remover um endereco, e e por isso que
 * toda acao da tela de enderecos manda a lista completa.
 */
export interface UpdateProfileInput {
  name?: string;
  email?: string;
  addresses?: AddressInput[];
}

/**
 * Um endereco no corpo do `PATCH`.
 *
 * `id` presente identifica um endereco que ja existe — e o que permite
 * corrigir o numero da casa sem o endereco trocar de identidade. Ausente, e
 * endereco novo e ganha o seu no servidor.
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

/** Quantos enderecos a conta guarda. O mesmo teto do backend. */
export const MAX_ADDRESSES = 10;

/** A senha do cliente: oito, e nao os doze do painel. */
export const PASSWORD_MIN_LENGTH = 8;

/** Quantos pedidos por pagina. O mesmo padrao do backend. */
export const ORDERS_PAGE_SIZE = 10;
