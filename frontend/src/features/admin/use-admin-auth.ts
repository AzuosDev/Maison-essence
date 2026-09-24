import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  useAdminSession,
  type AdminSessionResponse,
  type AdminUser,
  type UserRole,
} from '@/features/auth';
import {
  changePassword,
  login,
  logout,
  type ChangePasswordInput,
  type LoginInput,
} from './admin-auth.api';

/**
 * A sessão do painel, do ponto de vista das telas.
 *
 * O store de sessão (`features/auth`) guarda usuário e tokens; estes hooks
 * são a camada que as telas usam, e existem para que nenhuma delas precise
 * saber que há um `zustand` embaixo — nem repetir o par "gravar sessão e
 * limpar o cache" em cada lugar que faz login.
 */

/** Quem esta logado no painel, ou `null`. */
export function useAdminUser(): AdminUser | null {
  return useAdminSession((state) => state.user);
}

/** O papel de quem esta logado. `undefined` quando não há ninguém. */
export function useAdminRole(): UserRole | undefined {
  return useAdminSession((state) => state.user?.role);
}

/** Há sessão guardada neste navegador. */
export function useIsSignedIn(): boolean {
  return useAdminSession((state) => state.status === 'authenticated');
}

/**
 * A senha e temporária e precisa ser trocada.
 *
 * Enquanto for verdade, o painel inteiro fica bloqueado atrás da tela de
 * troca — o backend concorda: com `mustChangePassword`, toda rota
 * administrativa responde 403 menos `/auth/change-password` e `/auth/me`.
 * Não adiantaria deixar o menu aberto para telas que só devolveriam erro.
 */
export function useMustChangePassword(): boolean {
  return useAdminSession((state) => state.user?.mustChangePassword === true);
}

/**
 * O login.
 *
 * Sucesso grava a sessão e **limpa o cache de consultas**. A limpeza não e
 * zelo: duas pessoas usam o mesmo computador da loja, e sem ela a primeira
 * tela depois da troca de usuário mostraria os pedidos carregados pela
 * sessão anterior — inclusive para um STAFF que não deveria vê-los.
 */
export function useAdminLogin() {
  const signIn = useAdminSession((state) => state.signIn);
  const client = useQueryClient();

  return useMutation<AdminSessionResponse, unknown, LoginInput>({
    mutationFn: (input) => login(input),
    onSuccess: (session) => {
      client.clear();
      signIn(session.user, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    },
  });
}

/**
 * A troca de senha.
 *
 * A resposta já e uma sessão nova, sem a marca de senha temporária: grava-lá
 * e o que libera o painel, sem nenhuma consulta a mais.
 */
export function useChangePassword() {
  const signIn = useAdminSession((state) => state.signIn);

  return useMutation<AdminSessionResponse, unknown, ChangePasswordInput>({
    mutationFn: (input) => changePassword(input),
    onSuccess: (session) => {
      signIn(session.user, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    },
  });
}

/**
 * Sair.
 *
 * A sessão local cai primeiro e o aviso ao servidor vai depois, sem espera:
 * quem clicou em "Sair" precisa estar fora **agora**, e uma rede lenta não
 * pode deixar o painel aberto mais dez segundos. Se a chamada falhar, o
 * refresh token expira sozinho.
 */
export function useAdminSignOut(): () => void {
  // Lidos por seletor, e não por `getState()` dentro do callback: o store e
  // um hook, e um hook guardado numa variável para ser chamado depois e
  // justamente o que as regras de hooks proibem.
  const signOut = useAdminSession((state) => state.signOut);
  const refreshToken = useAdminSession((state) => state.tokens?.refreshToken ?? null);
  const client = useQueryClient();

  return useCallback(() => {
    signOut();
    client.clear();

    if (refreshToken !== null) {
      void logout(refreshToken).catch(() => {
        // Sessão já encerrada aqui. O servidor esquece o token no vencimento.
      });
    }
  }, [signOut, refreshToken, client]);
}
