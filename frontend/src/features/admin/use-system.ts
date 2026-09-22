import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/http';
import { adminKeys } from './admin.keys';
import {
  createUser,
  fetchHealth,
  listAudit,
  listCollections,
  listUsers,
  resetUserPassword,
  revokeSessions,
  runDemoSeed,
  setUserStatus,
  updateUser,
} from './system.api';
import type {
  AuditListParams,
  CreateUserInput,
  PasswordResetResult,
  SystemUser,
  UpdateUserInput,
} from './system.types';

/**
 * Os dados da area de sistema.
 *
 * ## O interruptor de status e otimista
 *
 * Ativar e desativar um usuario e a acao que mais se repete nesta tela, e o
 * `useSetUserStatus` a aplica no cache antes de o servidor responder: o
 * interruptor vira no dedo, como um interruptor. Se a chamada falhar — e ela
 * falha por motivos reais, como "voce nao pode desativar a si mesmo" ou
 * "este e o ultimo administrador ativo" —, o cache volta ao que era e quem
 * chamou mostra o aviso com a mensagem do servidor.
 *
 * O rollback guarda a lista inteira, e nao so o registro alterado. E o
 * caminho mais curto para ficar correto quando duas linhas sao trocadas
 * quase ao mesmo tempo: cada mutacao restaura o retrato que ela mesma viu.
 *
 * ## Nada de senha no cache
 *
 * `useResetPassword` e `useCreateUser` devolvem a senha temporaria pelo
 * retorno da mutacao, e ela para na tela. Nenhuma das duas escreve a senha
 * em `queryClient`: o cache sobrevive a navegacao, e a senha nao deve.
 */

/* ---- Usuarios ----------------------------------------------------------- */

export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: ({ signal }) => listUsers(signal),
    // Meio minuto: a lista muda quando alguem a edita, e quem edita esta
    // nesta tela e ja recebe a invalidacao.
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateUser() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/**
 * Ativa ou desativa, com o interruptor virando na hora.
 *
 * Note o `onSettled`: a invalidacao acontece no sucesso **e** na falha. No
 * sucesso, porque o servidor pode ter mexido em mais do que a flag — o
 * `updatedAt` mudou. Na falha, porque o retrato restaurado veio do cache e
 * pode ja estar velho por outra razao.
 */
export function useSetUserStatus() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserStatus(id, isActive),

    onMutate: async ({ id, isActive }) => {
      // Cancela o que estiver voando: uma resposta em transito chegaria
      // depois e sobrescreveria o estado otimista com o valor antigo.
      await client.cancelQueries({ queryKey: adminKeys.users() });

      const previous = client.getQueryData<SystemUser[]>(adminKeys.users());

      client.setQueryData<SystemUser[]>(adminKeys.users(), (current) =>
        current?.map((user) => (user.id === id ? { ...user, isActive } : user)),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(adminKeys.users(), context.previous);
      }
    },

    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/**
 * Reseta a senha e devolve a nova, uma vez.
 *
 * A lista e invalidada porque o registro muda de verdade —
 * `mustChangePassword` volta a ser verdadeiro, e a tela mostra isso.
 */
export function useResetPassword() {
  const client = useQueryClient();

  return useMutation<PasswordResetResult, Error, string>({
    mutationFn: (id: string) => resetUserPassword(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

/** Encerra as sessoes. A rota ainda nao existe — ver `system.api.ts`. */
export function useRevokeSessions() {
  return useMutation({
    mutationFn: (id: string) => revokeSessions(id),
  });
}

/* ---- Auditoria ---------------------------------------------------------- */

export function useAudit(params: AuditListParams) {
  return useQuery({
    queryKey: adminKeys.auditList(params),
    queryFn: ({ signal }) => listAudit(params, signal),
    // A trilha e imutavel: uma entrada gravada nao muda mais. O que pode
    // aparecer e uma entrada nova, e para isso ha o botao de recarregar.
    staleTime: 60_000,
    retry: (count, error) => !isMissingRoute(error) && count < 2,
  });
}

/* ---- Saude -------------------------------------------------------------- */

export function useHealth() {
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: ({ signal }) => fetchHealth(signal),
    // Saude e uma leitura do agora: nao vale guardar.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: adminKeys.collections(),
    queryFn: ({ signal }) => listCollections(signal),
    staleTime: 60_000,
    retry: (count, error) => !isMissingRoute(error) && count < 2,
  });
}

export function useDemoSeed() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => runDemoSeed(),
    onSuccess: () => {
      // O seed escreve em quase toda colecao: o painel inteiro esta velho.
      void client.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/* ---- O 404 que significa "a rota nao existe" ----------------------------- */

/**
 * A chamada caiu porque o backend nao publica essa rota.
 *
 * Tres telas desta area apontam para rotas que ainda nao existem, e o `404`
 * delas nao e um erro do usuario nem uma falha passageira: e uma ausencia.
 * Distinguir isso importa em dois lugares — a tela escreve a frase certa em
 * vez de "algo deu errado", e o React Query para de tentar de novo, porque
 * insistir num caminho que nao existe so gasta tempo.
 */
export function isMissingRoute(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}
