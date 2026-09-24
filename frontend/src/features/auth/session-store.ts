import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SessionPort, SessionScope, SessionTokens } from '@/lib/http';

/**
 * A fabrica das duas sessões.
 *
 * Painel e loja tem a mesma mecânica — guardar o par de tokens, guardar quem
 * esta logado, encerrar — e usuários de tipos diferentes. Escrever o store
 * duas vezes significaria corrigir todo ajuste de sessão em dois lugares, e
 * um dia só em um.
 *
 * ## Por que os tokens ficam em `localStorage`
 *
 * Não e a opção mais segura, e a escolha e consciente.
 *
 * O backend manda os tokens por duas vias: cookie `httpOnly` (que o
 * JavaScript não lê, e portanto um XSS não rouba) e o corpo da resposta. Em
 * produção a loja e a API ficam em domínios diferentes, e o cookie e
 * cross-site — exatamente o que o Safari bloqueia por padrão e o Chrome vem
 * restringindo. Depender só dele significaria, para uma parte dos clientes,
 * refazer o login a cada recarga de página, no meio de um checkout, no
 * celular. Foi por isso que o backend expoe o caminho do corpo.
 *
 * Então guardamos o par em `localStorage` e mandamos os dois caminhos em toda
 * requisição: onde o cookie funciona, ele e quem autentica; onde não, o
 * `Bearer` salva a sessão. O risco que sobra e XSS, e o que o contem esta
 * fora deste arquivo: nada de `dangerouslySetInnerHTML`, nada de HTML vindo
 * da API renderizado como markup, e os cabeçalhos de segurança que o backend
 * já aplica.
 */

export interface SessionState<User> {
  /** Quem esta logado, ou `null`. */
  user: User | null;

  /** O par de tokens. `null` quando não há sessão. */
  tokens: SessionTokens | null;

  /**
   * Há sessão ou não.
   *
   * Otimista de propósito: quem recarrega a página com tokens guardados entra
   * como autenticado, sem esperar uma confirmação da API. Não há limbo, não
   * há tela de carregando no boot — e, se os tokens não valerem mais, o
   * primeiro `401` sem renovação possível encerra a sessão.
   */
  status: 'anonymous' | 'authenticated';

  /** Login ou cadastro: guarda o usuário e o par de tokens de uma vez. */
  signIn: (user: User, tokens: SessionTokens) => void;

  /** Renovação: troca só os tokens, sem mexer em quem esta logado. */
  setTokens: (tokens: SessionTokens) => void;

  /** `/me` respondeu: atualiza o usuário sem tocar nos tokens. */
  setUser: (user: User) => void;

  /** Encerra a sessão local. Quem avisa a API e quem chamou. */
  signOut: () => void;
}

export type SessionStore<User> = UseBoundStore<StoreApi<SessionState<User>>>;

interface SessionConfig {
  /** Chave no `localStorage`. Uma por sessão: as duas convivem. */
  storageKey: string;
  scope: SessionScope;
  /** Onde a renovação e pedida, no formato que o cliente HTTP espera. */
  refreshPath: string;
}

export interface Session<User> {
  useStore: SessionStore<User>;
  /** O que o cliente HTTP precisa para anexar o token e renova-lo. */
  port: SessionPort;
  scope: SessionScope;
}

export function createSession<User>(config: SessionConfig): Session<User> {
  const useStore = create<SessionState<User>>()(
    persist(
      (set) => ({
        user: null,
        tokens: null,
        status: 'anonymous',

        signIn: (user, tokens) => {
          set({ user, tokens, status: 'authenticated' });
        },

        setTokens: (tokens) => {
          set({ tokens });
        },

        setUser: (user) => {
          set({ user, status: 'authenticated' });
        },

        signOut: () => {
          set({ user: null, tokens: null, status: 'anonymous' });
        },
      }),
      {
        name: config.storageKey,
        storage: createJSONStorage(() => localStorage),

        // Só o que precisa sobreviver a recarga. O `status` fica de fora
        // porque e derivado: quem manda e a existência dos tokens.
        partialize: (state) => ({ user: state.user, tokens: state.tokens }),

        // O `status` e recalculado na volta do armazenamento, a partir do que
        // foi guardado. Sem isto, a aplicação abriria como anonima com o
        // token na mão e mandaria o cliente logar de novo sem precisar.
        merge: (persisted, current): SessionState<User> => {
          const saved = persisted as Partial<SessionState<User>> | undefined;
          const tokens = saved?.tokens ?? null;

          return {
            ...current,
            user: saved?.user ?? null,
            tokens,
            status: tokens ? 'authenticated' : 'anonymous',
          };
        },
      },
    ),
  );

  const port: SessionPort = {
    refreshPath: config.refreshPath,

    // `getState()` a cada chamada, e não uma leitura no momento do registro:
    // o cliente HTTP precisa do token de agora, não do que existia no boot.
    read: () => useStore.getState().tokens,

    write: (tokens) => {
      useStore.getState().setTokens(tokens);
    },

    // A renovação foi recusada: o refresh token venceu, foi revogado ou a
    // conta foi desativada. A sessão local cai junto — insistir com ela só
    // produziria uma sequência de `401`.
    clear: () => {
      useStore.getState().signOut();
    },
  };

  return { useStore, port, scope: config.scope };
}
