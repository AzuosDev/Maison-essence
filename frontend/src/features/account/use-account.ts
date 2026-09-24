import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCustomerSession, type Customer } from '@/features/auth';
import {
  fetchMyOrder,
  fetchProfile,
  listMyOrders,
  loginCustomer,
  registerCustomer,
  updateProfile,
} from './account.api';
import { accountKeys } from './account.keys';
import {
  ORDERS_PAGE_SIZE,
  type AddressInput,
  type CustomerOrderDetail,
  type CustomerOrderSummary,
  type LoginInput,
  type Paginated,
  type RegisterInput,
  type UpdateProfileInput,
} from './account.types';

/**
 * O estado da conta, para as telas.
 *
 * ## A sessão não e uma consulta
 *
 * Quem esta logado vem do store do Zustand (`useCustomerSession`), que lê do
 * `localStorage` na abertura e não espera rede nenhuma. E o que faz a área
 * da conta abrir já sabendo quem e — sem tela de carregando no boot e, mais
 * importante, sem um instante de "deslogado" que faria a tela piscar o
 * convite na cara de quem já entrou.
 *
 * O `GET /customer/me` continua existindo, mas para outra coisa: trazer os
 * endereços atualizados. Ele confirma; ele não decide.
 */

/** Quem esta logado na loja, ou `null`. Não dispara requisição nenhuma. */
export function useCustomer(): Customer | null {
  return useCustomerSession((state) => state.user);
}

export function useIsSignedIn(): boolean {
  return useCustomerSession((state) => state.status === 'authenticated');
}

/**
 * A conta inteira, recarregada do servidor.
 *
 * `initialData` e o cliente guardado na sessão: a tela de endereços abre
 * desenhada, com o que o último login trouxe, e a consulta atualiza por
 * baixo. `initialDataUpdatedAt` no zero marca esse dado como velho na hora,
 * o que dispara a revalidação imediatamente — sem ele, o React Query
 * consideraria fresco por `staleTime` um objeto que pode ser de semanas
 * atrás.
 */
export function useProfile() {
  const signedIn = useIsSignedIn();
  const cached = useCustomer();

  return useQuery<Customer>({
    queryKey: accountKeys.profile(),
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled: signedIn,
    staleTime: 30_000,
    ...(cached === null ? {} : { initialData: cached, initialDataUpdatedAt: 0 }),
  });
}

/** Uma página do histórico. Do mais recente para o mais antigo. */
export function useMyOrders(page: number) {
  const signedIn = useIsSignedIn();

  return useQuery<Paginated<CustomerOrderSummary>>({
    queryKey: accountKeys.orderList(page),
    queryFn: ({ signal }) => listMyOrders(page, ORDERS_PAGE_SIZE, signal),
    enabled: signedIn,
    staleTime: 30_000,
  });
}

/**
 * Um pedido pelo código.
 *
 * `retry: false` porque a falha esperada aqui e o `404` de um pedido que não
 * e desta conta — insistir três vezes num código que nunca vai existir só
 * adia a mensagem em alguns segundos.
 */
export function useMyOrder(code: string) {
  const signedIn = useIsSignedIn();

  return useQuery<CustomerOrderDetail>({
    queryKey: accountKeys.order(code),
    queryFn: ({ signal }) => fetchMyOrder(code, signal),
    enabled: signedIn && code !== '',
    staleTime: 30_000,
    retry: false,
  });
}

/* ---- Entrar, cadastrar, sair ---------------------------------------------- */

/**
 * O que as duas portas de entrada fazem com a resposta.
 *
 * A sessão entra no store — e o `signIn` que liga o token das próximas
 * chamadas — e a conta já vai para o cache do perfil. Sem essa segunda
 * linha, a tela seguinte pediria `GET /customer/me` só para receber o objeto
 * que acabou de chegar no corpo do login.
 */
function useStartSession() {
  const signIn = useCustomerSession((state) => state.signIn);
  const client = useQueryClient();

  return useCallback(
    (session: { customer: Customer; accessToken: string; refreshToken: string }) => {
      signIn(session.customer, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });

      client.setQueryData(accountKeys.profile(), session.customer);
    },
    [signIn, client],
  );
}

export function useCustomerLogin() {
  const start = useStartSession();

  return useMutation({
    mutationFn: (input: LoginInput) => loginCustomer(input),
    onSuccess: start,
  });
}

/**
 * O cadastro.
 *
 * O servidor faz uma coisa a mais aqui, e ela e metade da razão de a conta
 * existir: ao criar, ele procura os pedidos feitos **como convidado** com
 * aquele telefone e os adota. Por isso o cadastro leva para os pedidos, e
 * não para o perfil — a lista já chega cheia, e e esse o primeiro gesto que
 * explica para que serve a conta.
 */
export function useCustomerRegister() {
  const start = useStartSession();

  return useMutation({
    mutationFn: (input: RegisterInput) => registerCustomer(input),
    onSuccess: start,
  });
}

/**
 * Sair.
 *
 * Local, e só local: **não há rota de logout do cliente na API**. O refresh
 * token continua válido no servidor até vencer ou ser rotacionado, e quem o
 * apaga e este navegador. Na prática o efeito e o que se espera — o par de
 * tokens some do `localStorage` e nenhuma chamada sai autenticada —, e o
 * caso que ficaria de fora exigiria alguém com acesso ao armazenamento deste
 * mesmo navegador, que já teria a sessão inteira de todo jeito.
 *
 * A limpeza do cache não esta aqui: mora em `watchAccountCache`, que escuta
 * a sessão e pega também as saídas que ninguém pediu — token vencido, conta
 * desativada, renovação recusada.
 */
export function useSignOut(): () => void {
  return useCustomerSession((state) => state.signOut);
}

/* ---- Editar --------------------------------------------------------------- */

/**
 * Salva o perfil e reaproveita a resposta.
 *
 * `PATCH /customer/me` devolve a conta inteira, já atualizada. Então a
 * resposta vai direto para o cache e para o store, em vez de invalidar e
 * pedir de novo: são dados que já estão em mãos, e uma segunda viagem só
 * deixaria a tela piscar.
 */
export function useUpdateProfile() {
  const client = useQueryClient();
  const setUser = useCustomerSession((state) => state.setUser);

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (customer) => {
      client.setQueryData(accountKeys.profile(), customer);

      // O store também guarda a conta, e e dele que a moldura lê o nome.
      setUser(customer);
    },
  });
}

/**
 * Salva a lista de endereços inteira.
 *
 * E a única forma que a API oferece: `addresses` substitui o que esta
 * gravado, e não há rota por endereço. Adicionar, editar, marcar como padrão
 * e excluir são, todas, esta mesma chamada com uma lista diferente — e a
 * tela monta essa lista a partir do que o **servidor** devolveu por último,
 * nunca de um rascunho local, porque mandar uma lista velha apagaria o que
 * foi salvo no meio tempo.
 */
export function useSaveAddresses() {
  const update = useUpdateProfile();
  const { mutateAsync } = update;

  const save = useCallback(
    (addresses: AddressInput[]) => mutateAsync({ addresses }),
    [mutateAsync],
  );

  return { ...update, save };
}
