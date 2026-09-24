import { SESSION_SCOPES, registerSession } from '@/lib/http';
import type { AdminUser, Customer } from './auth.types';
import { createSession } from './session-store';

/**
 * As duas sessões da aplicação, criadas uma vez.
 *
 * Os nomes no `localStorage` são diferentes pelo mesmo motivo que os cookies
 * do backend são: painel e loja convivem no mesmo navegador — a dona compra
 * na própria loja — e uma chave só faria o último login derrubar o outro. Em
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
 * Apresenta as duas sessões ao cliente HTTP.
 *
 * Chamada uma vez, no módulo de providers, antes de a aplicação renderizar —
 * e não dentro de um efeito. Um efeito rodaria depois do primeiro render, e
 * uma requisição disparada nesse intervalo sairia sem token e sem conseguir
 * renovar.
 */
export function registerSessions(): void {
  registerSession(customerSession.scope, customerSession.port);
  registerSession(adminSession.scope, adminSession.port);
}
