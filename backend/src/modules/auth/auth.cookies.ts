import type { CookieOptions, Request, Response } from 'express';
import { GLOBAL_PREFIX } from '../../bootstrap.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import type { IssuedTokens } from './auth.types.js';

export const ACCESS_TOKEN_COOKIE = 'me_access_token';
export const REFRESH_TOKEN_COOKIE = 'me_refresh_token';

/** O access token serve toda a API. */
export const ACCESS_COOKIE_PATH = `/${GLOBAL_PREFIX}`;

/**
 * O refresh token so serve as rotas de autenticacao.
 *
 * Com o `path` restrito, o navegador nem envia o refresh nas chamadas de
 * catalogo ou de pedido: uma falha de log ou um proxy intrometido em qualquer
 * outra rota nao tem como registrar a credencial de sessao.
 */
export const REFRESH_COOKIE_PATH = `/${GLOBAL_PREFIX}/auth`;

/**
 * Grava os dois cookies da sessao.
 *
 * `sameSite: 'none'` porque o painel roda em outro dominio da Vercel — sem
 * isso o navegador descarta o cookie na chamada cross-site. O par obrigatorio
 * disso e `secure: true`, que exige HTTPS; em desenvolvimento, onde o painel
 * fala com `http://localhost`, o navegador recusaria o par e a sessao ficaria
 * sem cookie nenhum, entao ali caimos para `lax` sem `secure`.
 */
export function setSessionCookies(
  response: Response,
  tokens: IssuedTokens,
  isDevelopment: boolean,
): void {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions(ACCESS_COOKIE_PATH, ACCESS_TOKEN_TTL_SECONDS, isDevelopment),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_COOKIE_PATH, REFRESH_TOKEN_TTL_SECONDS, isDevelopment),
  );
}

/** Apaga os cookies. Mesmo `path` e mesmos atributos, senao o navegador ignora. */
export function clearSessionCookies(response: Response, isDevelopment: boolean): void {
  response.clearCookie(
    ACCESS_TOKEN_COOKIE,
    cookieOptions(ACCESS_COOKIE_PATH, 0, isDevelopment),
  );
  response.clearCookie(
    REFRESH_TOKEN_COOKIE,
    cookieOptions(REFRESH_COOKIE_PATH, 0, isDevelopment),
  );
}

/** Refresh token do cookie ou, para quem nao recebe cookie, do corpo. */
export function readRefreshToken(
  request: Request,
  fromBody?: string,
): string | undefined {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;

  return cookies?.[REFRESH_TOKEN_COOKIE] ?? fromBody;
}

function cookieOptions(
  path: string,
  maxAgeSeconds: number,
  isDevelopment: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'none',
    path,
    ...(maxAgeSeconds > 0 ? { maxAge: maxAgeSeconds * 1000 } : {}),
  };
}
