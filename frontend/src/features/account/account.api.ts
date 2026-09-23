import type { CustomerSessionResponse } from '@/features/auth';
import { SESSION_SCOPES, api } from '@/lib/http';
import type {
  CustomerOrderDetail,
  CustomerOrderSummary,
  LoginInput,
  Paginated,
  RegisterInput,
  UpdateProfileInput,
} from './account.types';
import type { Customer } from '@/features/auth';

/**
 * As chamadas da conta do cliente.
 *
 * Duas familias, e a diferenca esta no `scope`.
 *
 * **Entrar e cadastrar sao publicas** (`scope: null`). Nao ha sessao ainda —
 * e justamente por isso que se esta chamando —, e um `401` aqui nao teria o
 * que renovar. Pior: com o escopo da loja, a recusa de senha errada
 * dispararia uma tentativa de renovacao com o refresh token de outra pessoa
 * que por acaso estivesse guardado neste navegador.
 *
 * **O resto usa `SESSION_SCOPES.STORE`**, que e o padrao do cliente HTTP mas
 * esta escrito por extenso: e ele que anexa o `Bearer` do cliente e renova a
 * sessao no primeiro `401`. Nenhuma destas chamadas toca o escopo do painel.
 */

export function registerCustomer(input: RegisterInput): Promise<CustomerSessionResponse> {
  return api.post<CustomerSessionResponse>('/customer/register', input, { scope: null });
}

export function loginCustomer(input: LoginInput): Promise<CustomerSessionResponse> {
  return api.post<CustomerSessionResponse>('/customer/login', input, { scope: null });
}

/**
 * A conta inteira, recarregada do servidor.
 *
 * O objeto que o login devolveu ja tem tudo isto, e ainda assim a tela pede
 * de novo: os enderecos mudam entre uma visita e outra — a propria pessoa os
 * edita no celular e depois abre no computador —, e o `customer` guardado no
 * `localStorage` e do dia em que ela entrou.
 */
export function fetchProfile(signal?: AbortSignal): Promise<Customer> {
  return api.get<Customer>('/customer/me', {
    scope: SESSION_SCOPES.STORE,
    ...(signal ? { signal } : {}),
  });
}

export function updateProfile(input: UpdateProfileInput): Promise<Customer> {
  return api.patch<Customer>('/customer/me', input, { scope: SESSION_SCOPES.STORE });
}

export function listMyOrders(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<Paginated<CustomerOrderSummary>> {
  return api.get<Paginated<CustomerOrderSummary>>('/customer/orders', {
    scope: SESSION_SCOPES.STORE,
    query: { page, limit },
    ...(signal ? { signal } : {}),
  });
}

/**
 * Um pedido pelo codigo, dentro da propria conta.
 *
 * Pedido de outra conta responde `404`, e nao `403` — dizer "existe, mas nao
 * e seu" ja seria contar demais sobre um codigo curto o bastante para se
 * tentar adivinhar. A tela trata o `404` como "este pedido nao e desta
 * conta", que e o que ele significa aqui.
 */
export function fetchMyOrder(code: string, signal?: AbortSignal): Promise<CustomerOrderDetail> {
  return api.get<CustomerOrderDetail>(`/customer/orders/${encodeURIComponent(code)}`, {
    scope: SESSION_SCOPES.STORE,
    ...(signal ? { signal } : {}),
  });
}
