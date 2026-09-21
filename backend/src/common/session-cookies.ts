import type { Request } from 'express';

/**
 * Os nomes dos cookies de sessao, em um lugar so.
 *
 * Sao quatro porque as duas audiencias coexistem no mesmo navegador: a dona
 * compra na propria loja, e em desenvolvimento painel e loja atendem no mesmo
 * `localhost`. Com nomes repetidos, o segundo login apagaria a sessao do
 * primeiro.
 *
 * Ficam aqui, e nao dentro de cada modulo, porque o guard do painel precisa
 * reconhecer o cookie da loja para responder "esta area nao e sua" — e ele
 * nao deveria ter de importar o modulo de clientes para isso.
 */
export const ACCESS_TOKEN_COOKIE = 'me_access_token';
export const REFRESH_TOKEN_COOKIE = 'me_refresh_token';
export const CUSTOMER_ACCESS_TOKEN_COOKIE = 'me_customer_access_token';
export const CUSTOMER_REFRESH_TOKEN_COOKIE = 'me_customer_refresh_token';

/** O valor de um cookie, ou `null` quando o request nao o traz. */
export function readCookie(request: Request, name: string): string | null {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;

  return cookies?.[name] ?? null;
}

/**
 * O token de `Authorization: Bearer`, ou `null`.
 *
 * O cabecalho e um so por request e serve as duas audiencias: o que decide de
 * quem e o token nao e onde ele veio, e sim qual segredo o verifica.
 */
export function readBearerToken(request: Request): string | null {
  const [scheme, value] = (request.get('authorization') ?? '').split(' ');

  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}

/** O access token de uma audiencia: cookie proprio primeiro, depois o cabecalho. */
export function readAccessTokenFrom(request: Request, cookieName: string): string | null {
  return readCookie(request, cookieName) ?? readBearerToken(request);
}
