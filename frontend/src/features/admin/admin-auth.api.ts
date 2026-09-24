import { api, SESSION_SCOPES } from '@/lib/http';
import type { AdminSessionResponse, AdminUser } from '@/features/auth';

/**
 * As chamadas de sessão do painel.
 *
 * Três rotas e uma diferença de escopo que importa: o login sai **sem**
 * sessão (`scope: null`) porque ele e a chamada que cria uma; as outras duas
 * vão no escopo do painel, e por isso um `401` nelas tenta renovar antes de
 * desistir.
 */

export interface LoginInput {
  email: string;
  password: string;
}

export function login(input: LoginInput, signal?: AbortSignal): Promise<AdminSessionResponse> {
  return api.post<AdminSessionResponse>('/auth/login', input, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * A troca de senha, que também e o fim da senha temporária.
 *
 * Responde com uma sessão nova — tokens e usuário já sem
 * `mustChangePassword` —, e e por isso que a tela não precisa pedir `/me`
 * depois: o próprio retorno desbloqueia o painel.
 */
export function changePassword(
  input: ChangePasswordInput,
  signal?: AbortSignal,
): Promise<AdminSessionResponse> {
  return api.patch<AdminSessionResponse>('/auth/change-password', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Encerra a sessão no servidor.
 *
 * O refresh token vai no corpo porque em produção o cookie e cross-site e
 * pode não chegar — a mesma razão que faz a sessão viver no `localStorage`.
 * Sem ele, o token continuaria válido até expirar sozinho.
 */
export function logout(refreshToken: string, signal?: AbortSignal): Promise<void> {
  return api.post<void>(
    '/auth/logout',
    { refreshToken },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/** Quem esta logado, conferido no servidor. */
export function fetchMe(signal?: AbortSignal): Promise<AdminUser> {
  return api.get<AdminUser>('/auth/me', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}
