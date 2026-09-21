import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SessionPort, SessionScope, SessionTokens } from '@/lib/http';

/**
 * A fabrica das duas sessoes.
 *
 * Painel e loja tem a mesma mecanica — guardar o par de tokens, guardar quem
 * esta logado, encerrar — e usuarios de tipos diferentes. Escrever o store
 * duas vezes significaria corrigir todo ajuste de sessao em dois lugares, e
 * um dia so em um.
 *
 * ## Por que os tokens ficam em `localStorage`
 *
 * Nao e a opcao mais segura, e a escolha e consciente.
 *
 * O backend manda os tokens por duas vias: cookie `httpOnly` (que o
 * JavaScript nao le, e portanto um XSS nao rouba) e o corpo da resposta. Em
 * producao a loja e a API ficam em dominios diferentes, e o cookie e
 * cross-site — exatamente o que o Safari bloqueia por padrao e o Chrome vem
 * restringindo. Depender so dele significaria, para uma parte dos clientes,
 * refazer o login a cada recarga de pagina, no meio de um checkout, no
 * celular. Foi por isso que o backend expoe o caminho do corpo.
 *
 * Entao guardamos o par em `localStorage` e mandamos os dois caminhos em toda
 * requisicao: onde o cookie funciona, ele e quem autentica; onde nao, o
 * `Bearer` salva a sessao. O risco que sobra e XSS, e o que o contem esta
 * fora deste arquivo: nada de `dangerouslySetInnerHTML`, nada de HTML vindo
 * da API renderizado como markup, e os cabecalhos de seguranca que o backend
 * ja aplica.
 */

export interface SessionState<User> {
  /** Quem esta logado, ou `null`. */
  user: User | null;

  /** O par de tokens. `null` quando nao ha sessao. */
  tokens: SessionTokens | null;

  /**
   * Ha sessao ou nao.
   *
   * Otimista de proposito: quem recarrega a pagina com tokens guardados entra
   * como autenticado, sem esperar uma confirmacao da API. Nao ha limbo, nao
   * ha tela de carregando no boot — e, se os tokens nao valerem mais, o
   * primeiro `401` sem renovacao possivel encerra a sessao.
   */
  status: 'anonymous' | 'authenticated';

  /** Login ou cadastro: guarda o usuario e o par de tokens de uma vez. */
  signIn: (user: User, tokens: SessionTokens) => void;

  /** Renovacao: troca so os tokens, sem mexer em quem esta logado. */
  setTokens: (tokens: SessionTokens) => void;

  /** `/me` respondeu: atualiza o usuario sem tocar nos tokens. */
  setUser: (user: User) => void;

  /** Encerra a sessao local. Quem avisa a API e quem chamou. */
  signOut: () => void;
}

export type SessionStore<User> = UseBoundStore<StoreApi<SessionState<User>>>;

interface SessionConfig {
  /** Chave no `localStorage`. Uma por sessao: as duas convivem. */
  storageKey: string;
  scope: SessionScope;
  /** Onde a renovacao e pedida, no formato que o cliente HTTP espera. */
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

        // So o que precisa sobreviver a recarga. O `status` fica de fora
        // porque e derivado: quem manda e a existencia dos tokens.
        partialize: (state) => ({ user: state.user, tokens: state.tokens }),

        // O `status` e recalculado na volta do armazenamento, a partir do que
        // foi guardado. Sem isto, a aplicacao abriria como anonima com o
        // token na mao e mandaria o cliente logar de novo sem precisar.
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

    // `getState()` a cada chamada, e nao uma leitura no momento do registro:
    // o cliente HTTP precisa do token de agora, nao do que existia no boot.
    read: () => useStore.getState().tokens,

    write: (tokens) => {
      useStore.getState().setTokens(tokens);
    },

    // A renovacao foi recusada: o refresh token venceu, foi revogado ou a
    // conta foi desativada. A sessao local cai junto — insistir com ela so
    // produziria uma sequencia de `401`.
    clear: () => {
      useStore.getState().signOut();
    },
  };

  return { useStore, port, scope: config.scope };
}
