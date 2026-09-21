import { SESSION_SCOPES, registerSession } from '@/lib/http';
import type { AdminUser, Customer } from './auth.types';
import { createSession } from './session-store';

/**
 * As duas sessoes da aplicacao, criadas uma vez.
 *
 * Os nomes no `localStorage` sao diferentes pelo mesmo motivo que os cookies
 * do backend sao: painel e loja convivem no mesmo navegador — a dona compra
 * na propria loja — e uma chave so faria o ultimo login derrubar o outro. Em
 * desenvolvimento, onde os dois rodam no mesmo `localhost`, isso deixaria de
 * ser hipotese.
 */

/** A conta do cliente. Renovada em `POST /customer/refresh`. */
const customerSession = createSession<Customer>({
  storageKey: 'maison-essence.customer-session',
  scope: SESSION_SCOPES.STORE,
  refreshPath: '/customer/refresh',
});

/** O painel. Renovado em `POST /auth/refresh`. */
const adminSession = createSession<AdminUser>({
  storageKey: 'maison-essence.admin-session',
  scope: SESSION_SCOPES.ADMIN,
  refreshPath: '/auth/refresh',
});

export const useCustomerSession = customerSession.useStore;
export const useAdminSession = adminSession.useStore;

/**
 * Apresenta as duas sessoes ao cliente HTTP.
 *
 * Chamada uma vez, no modulo de providers, antes de a aplicacao renderizar —
 * e nao dentro de um efeito. Um efeito rodaria depois do primeiro render, e
 * uma requisicao disparada nesse intervalo sairia sem token e sem conseguir
 * renovar.
 */
export function registerSessions(): void {
  registerSession(customerSession.scope, customerSession.port);
  registerSession(adminSession.scope, adminSession.port);
}
