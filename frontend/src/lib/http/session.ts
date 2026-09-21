/**
 * De quem e a sessao que autentica cada requisicao.
 *
 * Existem duas, e elas convivem no mesmo navegador de proposito: a dona
 * compra na propria loja. O backend emite os dois pares de token com segredos
 * diferentes, audiencias diferentes (`maison-essence/admin` e
 * `maison-essence/customer`) e cookies de nome diferente — e renova cada um
 * em uma rota propria. Um cliente HTTP que conhecesse "o token" derrubaria
 * uma sessao ao renovar a outra.
 *
 * O cliente HTTP nao sabe onde os tokens moram: ele conhece esta interface, e
 * quem a implementa e o store de sessao em `features/auth`. A inversao existe
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
 * O par de tokens de uma sessao.
 *
 * Os dois chegam no corpo do login. Os mesmos valores tambem vem em cookie
 * `httpOnly`, e esse e o caminho preferido — mas ele depende de cookie de
 * terceiro, que o Safari bloqueia por padrao quando a loja e a API estao em
 * dominios diferentes. Por isso o backend devolve os dois no corpo tambem, e
 * por isso o cliente manda `Authorization: Bearer` mesmo quando o cookie
 * existe: o que nao for usado e ignorado, e a sessao funciona nos dois casos.
 */
export interface SessionTokens {
  accessToken: string;
  /** `null` quando so o cookie carrega o refresh. */
  refreshToken: string | null;
}

export interface SessionPort {
  /** Onde a renovacao e pedida. `/auth/refresh` no painel, `/customer/refresh` na loja. */
  readonly refreshPath: string;

  /** Os tokens de agora, ou `null` quando nao ha sessao. */
  read(): SessionTokens | null;

  /** Guarda o par recem-emitido pela renovacao. */
  write(tokens: SessionTokens): void;

  /** A renovacao falhou: a sessao acabou e quem implementa decide o que fazer. */
  clear(): void;
}

const ports = new Map<SessionScope, SessionPort>();

/**
 * Liga um escopo ao store que o mantem. Chamado uma vez, no boot da
 * aplicacao (`app/providers.tsx`), antes da primeira requisicao.
 */
export function registerSession(scope: SessionScope, port: SessionPort): void {
  ports.set(scope, port);
}

export function sessionFor(scope: SessionScope): SessionPort | null {
  return ports.get(scope) ?? null;
}
