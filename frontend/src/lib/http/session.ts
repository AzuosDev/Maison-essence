/**
 * De quem e a sessão que autentica cada requisição.
 *
 * Existem duas, e elas convivem no mesmo navegador de propósito: a dona
 * compra na própria loja. O backend emite os dois pares de token com segredos
 * diferentes, audiências diferentes (`maison-essence/admin` e
 * `maison-essence/customer`) e cookies de nome diferente — e renova cada um
 * em uma rota própria. Um cliente HTTP que conhecesse "o token" derrubaria
 * uma sessão ao renovar a outra.
 *
 * O cliente HTTP não sabe onde os tokens moram: ele conhece esta interface, e
 * quem a implementa e o store de sessão em `features/auth`. A inversão existe
 * para quebrar o ciclo — o store precisa do cliente para chamar a API, e o
 * cliente precisa do token que o store guarda.
 */

export const SESSION_SCOPES = {
  /** A conta do cliente da loja. */
  STORE: 'store',
  /** O painel administrativo. */
  ADMIN: 'admin',
} as const;

export type SessionScope = (typeof SESSION_SCOPES)[keyof typeof SESSION_SCOPES];

/**
 * O par de tokens de uma sessão.
 *
 * Os dois chegam no corpo do login. Os mesmos valores também vem em cookie
 * `httpOnly`, e esse e o caminho preferido — mas ele depende de cookie de
 * terceiro, que o Safari bloqueia por padrão quando a loja e a API estão em
 * domínios diferentes. Por isso o backend devolve os dois no corpo também, e
 * por isso o cliente manda `Authorization: Bearer` mesmo quando o cookie
 * existe: o que não for usado e ignorado, e a sessão funciona nos dois casos.
 */
export interface SessionTokens {
  accessToken: string;
  /** `null` quando só o cookie carrega o refresh. */
  refreshToken: string | null;
}

export interface SessionPort {
  /** Onde a renovação e pedida. `/auth/refresh` no painel, `/customer/refresh` na loja. */
  readonly refreshPath: string;

  /** Os tokens de agora, ou `null` quando não há sessão. */
  read(): SessionTokens | null;

  /** Guarda o par recém-emitido pela renovação. */
  write(tokens: SessionTokens): void;

  /** A renovação falhou: a sessão acabou e quem implementa decide o que fazer. */
  clear(): void;
}

const ports = new Map<SessionScope, SessionPort>();

/**
 * Liga um escopo ao store que o mantem. Chamado uma vez, no boot da
 * aplicação (`app/providers.tsx`), antes da primeira requisição.
 */
export function registerSession(scope: SessionScope, port: SessionPort): void {
  ports.set(scope, port);
}

export function sessionFor(scope: SessionScope): SessionPort | null {
  return ports.get(scope) ?? null;
}
