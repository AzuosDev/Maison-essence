import { env } from '@/lib/env';
import { ApiError, NetworkError, type ApiErrorBody } from './api-error';
import { SESSION_SCOPES, sessionFor, type SessionPort, type SessionScope } from './session';

/**
 * O único jeito de falar com a API.
 *
 * Nenhum `fetch` solto no resto da aplicação: tudo passa por aqui, e por isso
 * três regras valem sem exceção e sem ninguém precisar lembrar delas.
 *
 * 1. A URL sai de `VITE_API_URL`. Trocar de ambiente e trocar a variável.
 * 2. O access token e anexado na saída, lido na hora — e não capturado
 *    quando a função foi escrita. Uma renovação no meio do caminho vale já
 *    para a próxima tentativa.
 * 3. Um `401` dispara uma renovação, e uma só. Deu certo, a requisição e
 *    refeita; deu errado, a sessão e encerrada e o `401` sobe para a tela.
 *
 * O ponto delicado e a terceira. A loja abre várias chamadas em paralelo, e o
 * access token expira para todas ao mesmo tempo. Se cada `401` pedisse a sua
 * própria renovação, o backend receberia várias chamadas com o *mesmo* refresh
 * token — e, como ele rotaciona o token a cada uso e trata reuso como sinal de
 * roubo, a segunda derrubaria a sessão inteira. Por isso as renovações
 * concorrentes compartilham uma promessa só (`refreshing`), e quem chega
 * depois de a renovação já ter acontecido nem chega a pedir outra: percebe
 * pelo token que o seu já era o antigo e apenas repete a requisição.
 */

/**
 * Teto de espera por resposta.
 *
 * Generoso de propósito: a API e uma função serverless, e o primeiro acesso
 * depois de um período parado paga 2–4 s de cold start. Um limite apertado
 * transformaria isso num erro na cara do cliente.
 */
const DEFAULT_TIMEOUT_MS = 20_000;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryValue =
  string | number | boolean | null | undefined | readonly (string | number)[];

export type QueryParams = Readonly<Record<string, QueryValue>>;

export interface RequestOptions {
  method?: HttpMethod;
  /** Serializado como JSON. `undefined` não manda corpo nenhum. */
  body?: unknown;
  query?: QueryParams;
  headers?: Readonly<Record<string, string>>;
  /** Cancelamento do chamador — e o que o TanStack Query passa. */
  signal?: AbortSignal;
  /**
   * Qual sessão autentica. `null` para rota publica: sem `Authorization` e,
   * principalmente, sem tentar renovar nada se vier `401`.
   */
  scope?: SessionScope | null;
  timeoutMs?: number;
}

/** Uma renovação em andamento por escopo. E ela que evita o refresh duplicado. */
const refreshing = new Map<SessionScope, Promise<boolean>>();

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const scope = options.scope === undefined ? SESSION_SCOPES.STORE : options.scope;
  const url = buildUrl(path, options.query);
  const init = buildInit(options);

  let attempt = await send(url, init, scope, options);

  if (attempt.response.status === 401 && scope !== null) {
    // A única retentativa. Se a renovação falhar, o `401` original sobe.
    const renewed = await renewSession(scope, attempt.accessToken);

    if (renewed) {
      attempt = await send(url, init, scope, options);
    }
  }

  return parseResponse<T>(attempt.response, path);
}

/** Os verbos, com o corpo no lugar que cada um espera. */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> => apiRequest<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> => apiRequest<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> => apiRequest<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
} as const;

/** O que uma tentativa produziu, e com qual token ela saiu. */
interface Attempt {
  response: Response;
  /** O access token usado. E a chave para não renovar duas vezes. */
  accessToken: string | null;
}

async function send(
  url: string,
  init: RequestInit,
  scope: SessionScope | null,
  options: RequestOptions,
): Promise<Attempt> {
  // Lido agora, e não no `buildInit`: entre a primeira tentativa e a segunda
  // o token mudou, e e justamente o novo que precisa ir.
  const accessToken = scope === null ? null : (sessionFor(scope)?.read()?.accessToken ?? null);

  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Um tempo limite por tentativa: o da primeira não pode cancelar a segunda.
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    const response = await fetch(url, { ...init, headers, signal });

    return { response, accessToken };
  } catch (cause) {
    // Cancelamento do chamador sobe como esta: o TanStack Query o reconhece
    // e não o trata como falha da tela.
    if (options.signal?.aborted) {
      throw cause;
    }

    throw new NetworkError(url, timeout.aborted, cause);
  }
}

/**
 * Garante uma sessão valida para o escopo, renovando no máximo uma vez.
 *
 * Devolve `false` quando não há o que renovar ou quando a renovação foi
 * recusada — e nesse caso a sessão já foi encerrada por quem implementa o
 * `SessionPort`.
 */
async function renewSession(scope: SessionScope, usedToken: string | null): Promise<boolean> {
  const port = sessionFor(scope);

  if (!port) {
    return false;
  }

  const current = port.read();

  if (!current) {
    // Não há sessão: o `401` e a resposta certa para uma rota protegida
    // aberta por quem não entrou.
    return false;
  }

  // Outra requisição já renovou enquanto esta estava no ar. Pedir de novo
  // usaria um refresh token já gasto, e o backend leria isso como reuso.
  if (usedToken !== null && current.accessToken !== usedToken) {
    return true;
  }

  const running = refreshing.get(scope);

  if (running) {
    return running;
  }

  const attempt = refresh(port).finally(() => {
    refreshing.delete(scope);
  });

  refreshing.set(scope, attempt);

  return attempt;
}

async function refresh(port: SessionPort): Promise<boolean> {
  const current = port.read();

  // O cookie `httpOnly` e o caminho preferido; o corpo atende quem não
  // recebe cookie de terceiro. Mandar os dois não custa nada: o backend lê o
  // cookie primeiro e ignora o resto.
  const body = current?.refreshToken ? { refreshToken: current.refreshToken } : {};

  let response: Response;

  try {
    response = await fetch(`${env.VITE_API_URL}${port.refreshPath}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // A rede caiu no meio da renovação. A sessão continua de pé: derrubar
    // quem esta no checkout por causa de um tunel de metro seria pior que
    // deixar a próxima chamada tentar de novo.
    return false;
  }

  if (!response.ok) {
    port.clear();

    return false;
  }

  const session: unknown = await response.json().catch(() => null);

  if (!isRenewedSession(session)) {
    port.clear();

    return false;
  }

  port.write({
    accessToken: session.accessToken,
    refreshToken: typeof session.refreshToken === 'string' ? session.refreshToken : null,
  });

  return true;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${env.VITE_API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    // `undefined` e `null` somem: e o que permite passar o filtro opcional
    // direto do estado da tela, sem montar o objeto condicionalmente.
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }

      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();

  return search ? `${url}?${search}` : url;
}

function buildInit(options: RequestOptions): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };

  const hasBody = options.body !== undefined;

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return {
    method: options.method ?? 'GET',
    headers,
    // Os cookies de sessão são `httpOnly` e cross-site: sem isto, o navegador
    // não os envia e só o caminho do `Bearer` funcionaria.
    credentials: 'include',
    // Serializado uma vez só: o corpo precisa sobreviver a retentativa, e um
    // stream só pode ser lido uma vez.
    ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
  };
}

async function parseResponse<T>(response: Response, path: string): Promise<T> {
  // `204` e o que as rotas de logout e de exclusão devolvem.
  if (response.ok && (response.status === 204 || response.headers.get('content-length') === '0')) {
    return undefined as T;
  }

  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const body = isApiErrorBody(payload) ? payload : null;

    throw new ApiError(response.status, messagesFrom(body, response), path, body);
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Resposta que não e JSON: página de erro de proxy, HTML de manutenção.
    // O texto cru continua útil na mensagem de erro.
    return text;
  }
}

function messagesFrom(body: ApiErrorBody | null, response: Response): string[] {
  if (!body) {
    return [`A requisição falhou (${response.status}).`];
  }

  return Array.isArray(body.message) ? body.message : [body.message];
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const body = value as Partial<ApiErrorBody>;

  return (
    typeof body.statusCode === 'number' &&
    (typeof body.message === 'string' || Array.isArray(body.message))
  );
}

function isRenewedSession(
  value: unknown,
): value is { accessToken: string; refreshToken?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { accessToken?: unknown }).accessToken === 'string'
  );
}
