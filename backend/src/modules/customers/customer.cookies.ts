import type { Request, Response } from 'express';
import { GLOBAL_PREFIX } from '../../bootstrap.js';
import {
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS,
} from '../auth/auth.constants.js';
import { sessionCookieOptions } from '../auth/auth.cookies.js';
import {
  CUSTOMER_ACCESS_TOKEN_COOKIE,
  CUSTOMER_REFRESH_TOKEN_COOKIE,
  readAccessTokenFrom,
  readCookie,
} from '../../common/session-cookies.js';

/**
 * Cookies da sessão da loja, com nomes próprios.
 *
 * Nomes diferentes dos do painel porque as duas sessões podem coexistir no
 * mesmo navegador — a dona compra na própria loja — e um nome só faria o
 * último login derrubar o outro. Em desenvolvimento, onde painel e loja
 * rodam no mesmo `localhost`, isso deixaria de ser hipotese.
 */
export { CUSTOMER_ACCESS_TOKEN_COOKIE, CUSTOMER_REFRESH_TOKEN_COOKIE };

/** O access token da loja serve toda a API publica. */
const ACCESS_PATH = `/${GLOBAL_PREFIX}`;

/** O refresh só serve as rotas de conta, como no painel. */
const REFRESH_PATH = `/${GLOBAL_PREFIX}/customer`;

/** Par de tokens recém-emitido, como o cookie precisa dele. */
interface CustomerTokens {
  accessToken: string;
  refreshToken: string;
}

export function setCustomerCookies(
  response: Response,
  tokens: CustomerTokens,
  isDevelopment: boolean,
): void {
  response.cookie(
    CUSTOMER_ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    sessionCookieOptions(ACCESS_PATH, CUSTOMER_ACCESS_TOKEN_TTL_SECONDS, isDevelopment),
  );
  response.cookie(
    CUSTOMER_REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    sessionCookieOptions(REFRESH_PATH, CUSTOMER_REFRESH_TOKEN_TTL_SECONDS, isDevelopment),
  );
}

/** Refresh token do cookie ou, para quem não recebe cookie, do corpo. */
export function readCustomerRefreshToken(
  request: Request,
  fromBody?: string,
): string | undefined {
  return readCookie(request, CUSTOMER_REFRESH_TOKEN_COOKIE) ?? fromBody;
}

/**
 * Access token da loja: cookie próprio primeiro, depois `Authorization`.
 *
 * O cabeçalho e compartilhado com o painel — só existe um `Authorization` por
 * request — e tudo bem: o token que vier por ali só passa na verificação de
 * quem tiver o segredo certo, e cada lado tem o seu.
 */
export function readCustomerAccessToken(request: Request): string | null {
  return readAccessTokenFrom(request, CUSTOMER_ACCESS_TOKEN_COOKIE);
}
