import { api, SESSION_SCOPES } from '@/lib/http';
import type { AdminSessionResponse, AdminUser } from '@/features/auth';

/**
 * As chamadas de sessao do painel.
 *
 * Tres rotas e uma diferenca de escopo que importa: o login sai **sem**
 * sessao (`scope: null`) porque ele e a chamada que cria uma; as outras duas
 * vao no escopo do painel, e por isso um `401` nelas tenta renovar antes de
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
 * A troca de senha, que tambem e o fim da senha temporaria.
 *
 * Responde com uma sessao nova — tokens e usuario ja sem
 * `mustChangePassword` —, e e por isso que a tela nao precisa pedir `/me`
 * depois: o proprio retorno desbloqueia o painel.
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
 * Encerra a sessao no servidor.
 *
 * O refresh token vai no corpo porque em producao o cookie e cross-site e
 * pode nao chegar — a mesma razao que faz a sessao viver no `localStorage`.
 * Sem ele, o token continuaria valido ate expirar sozinho.
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
