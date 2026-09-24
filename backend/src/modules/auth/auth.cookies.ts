import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  readCookie,
} from '../../common/session-cookies.js';
import { GLOBAL_PREFIX } from '../../bootstrap.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import type { IssuedTokens } from './auth.types.js';

// Os nomes vivem em `common/session-cookies.ts`, com os da loja: o guard do
// painel precisa conhecer os dois conjuntos. Reexportados aqui porque este e
// o arquivo que o resto do módulo já importa.
export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };

/** O access token serve toda a API. */
export const ACCESS_COOKIE_PATH = `/${GLOBAL_PREFIX}`;

/**
 * O refresh token só serve as rotas de autenticação.
 *
 * Com o `path` restrito, o navegador nem envia o refresh nas chamadas de
 * catálogo ou de pedido: uma falha de log ou um proxy intrometido em qualquer
 * outra rota não tem como registrar a credencial de sessão.
 */
export const REFRESH_COOKIE_PATH = `/${GLOBAL_PREFIX}/auth`;

/**
 * Grava os dois cookies da sessão.
 *
 * `sameSite: 'none'` porque o painel roda em outro domínio da Vercel — sem
 * isso o navegador descarta o cookie na chamada cross-site. O par obrigatório
 * disso e `secure: true`, que exige HTTPS; em desenvolvimento, onde o painel
 * fala com `http://localhost`, o navegador recusaria o par e a sessão ficaria
 * sem cookie nenhum, então ali caimos para `lax` sem `secure`.
 */
export function setSessionCookies(
  response: Response,
  tokens: IssuedTokens,
  isDevelopment: boolean,
): void {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    sessionCookieOptions(ACCESS_COOKIE_PATH, ACCESS_TOKEN_TTL_SECONDS, isDevelopment),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    sessionCookieOptions(REFRESH_COOKIE_PATH, REFRESH_TOKEN_TTL_SECONDS, isDevelopment),
  );
}

/** Apaga os cookies. Mesmo `path` e mesmos atributos, senão o navegador ignora. */
export function clearSessionCookies(response: Response, isDevelopment: boolean): void {
  response.clearCookie(
    ACCESS_TOKEN_COOKIE,
    sessionCookieOptions(ACCESS_COOKIE_PATH, 0, isDevelopment),
  );
  response.clearCookie(
    REFRESH_TOKEN_COOKIE,
    sessionCookieOptions(REFRESH_COOKIE_PATH, 0, isDevelopment),
  );
}

/** Refresh token do cookie ou, para quem não recebe cookie, do corpo. */
export function readRefreshToken(
  request: Request,
  fromBody?: string,
): string | undefined {
  return readCookie(request, REFRESH_TOKEN_COOKIE) ?? fromBody;
}

/**
 * Opções de cookie de sessão, compartilhadas pelas duas audiências.
 *
 * Exportada para o módulo de clientes usar as mesmas regras: um cookie de
 * sessão da loja com política diferente da do painel seria uma segunda
 * decisão de segurança, tomada em outro arquivo, para o mesmo problema.
 */
export function sessionCookieOptions(
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
