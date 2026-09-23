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
 * ## A sessao nao e uma consulta
 *
 * Quem esta logado vem do store do Zustand (`useCustomerSession`), que le do
 * `localStorage` na abertura e nao espera rede nenhuma. E o que faz a area
 * da conta abrir ja sabendo quem e — sem tela de carregando no boot e, mais
 * importante, sem um instante de "deslogado" que faria a tela piscar o
 * convite na cara de quem ja entrou.
 *
 * O `GET /customer/me` continua existindo, mas para outra coisa: trazer os
 * enderecos atualizados. Ele confirma; ele nao decide.
 */

/** Quem esta logado na loja, ou `null`. Nao dispara requisicao nenhuma. */
export function useCustomer(): Customer | null {
  return useCustomerSession((state) => state.user);
}

export function useIsSignedIn(): boolean {
  return useCustomerSession((state) => state.status === 'authenticated');
}

/**
 * A conta inteira, recarregada do servidor.
 *
 * `initialData` e o cliente guardado na sessao: a tela de enderecos abre
 * desenhada, com o que o ultimo login trouxe, e a consulta atualiza por
 * baixo. `initialDataUpdatedAt` no zero marca esse dado como velho na hora,
 * o que dispara a revalidacao imediatamente — sem ele, o React Query
 * consideraria fresco por `staleTime` um objeto que pode ser de semanas
 * atras.
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

/** Uma pagina do historico. Do mais recente para o mais antigo. */
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
 * Um pedido pelo codigo.
 *
 * `retry: false` porque a falha esperada aqui e o `404` de um pedido que nao
 * e desta conta — insistir tres vezes num codigo que nunca vai existir so
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
 * A sessao entra no store — e o `signIn` que liga o token das proximas
 * chamadas — e a conta ja vai para o cache do perfil. Sem essa segunda
 * linha, a tela seguinte pediria `GET /customer/me` so para receber o objeto
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
 * O servidor faz uma coisa a mais aqui, e ela e metade da razao de a conta
 * existir: ao criar, ele procura os pedidos feitos **como convidado** com
 * aquele telefone e os adota. Por isso o cadastro leva para os pedidos, e
 * nao para o perfil — a lista ja chega cheia, e e esse o primeiro gesto que
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
 * Local, e so local: **nao ha rota de logout do cliente na API**. O refresh
 * token continua valido no servidor ate vencer ou ser rotacionado, e quem o
 * apaga e este navegador. Na pratica o efeito e o que se espera — o par de
 * tokens some do `localStorage` e nenhuma chamada sai autenticada —, e o
 * caso que ficaria de fora exigiria alguem com acesso ao armazenamento deste
 * mesmo navegador, que ja teria a sessao inteira de todo jeito.
 *
 * A limpeza do cache nao esta aqui: mora em `watchAccountCache`, que escuta
 * a sessao e pega tambem as saidas que ninguem pediu — token vencido, conta
 * desativada, renovacao recusada.
 */
export function useSignOut(): () => void {
  return useCustomerSession((state) => state.signOut);
}

/* ---- Editar --------------------------------------------------------------- */

/**
 * Salva o perfil e reaproveita a resposta.
 *
 * `PATCH /customer/me` devolve a conta inteira, ja atualizada. Entao a
 * resposta vai direto para o cache e para o store, em vez de invalidar e
 * pedir de novo: sao dados que ja estao em maos, e uma segunda viagem so
 * deixaria a tela piscar.
 */
export function useUpdateProfile() {
  const client = useQueryClient();
  const setUser = useCustomerSession((state) => state.setUser);

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (customer) => {
      client.setQueryData(accountKeys.profile(), customer);

      // O store tambem guarda a conta, e e dele que a moldura le o nome.
      setUser(customer);
    },
  });
}

/**
 * Salva a lista de enderecos inteira.
 *
 * E a unica forma que a API oferece: `addresses` substitui o que esta
 * gravado, e nao ha rota por endereco. Adicionar, editar, marcar como padrao
 * e excluir sao, todas, esta mesma chamada com uma lista diferente — e a
 * tela monta essa lista a partir do que o **servidor** devolveu por ultimo,
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
