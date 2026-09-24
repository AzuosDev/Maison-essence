import { beforeEach, expect, test, vi } from 'vitest';
import { api, registerSession, SESSION_SCOPES, type SessionPort } from '@/lib/http';

/**
 * O refresh compartilhado.
 *
 * E a unica parte do cliente HTTP que so quebra sob concorrencia — e falha
 * calada: a sessao cai sozinha, em producao, para quem estava com duas abas
 * abertas ou com a home pedindo tres prateleiras de uma vez. Nao da para
 * testar isso a mao, entao esta aqui.
 *
 * O `fetch` e trocado por um dublê para que os testes descrevam o que o
 * backend faria — rotacionar o refresh token, recusar o token ja gasto — sem
 * precisar da API no ar.
 */

let tokens: { accessToken: string; refreshToken: string | null } | null = null;
let refreshCalls = 0;
let clearCalls = 0;

const port: SessionPort = {
  refreshPath: '/customer/refresh',
  read: () => tokens,
  write: (next) => {
    tokens = next;
  },
  clear: () => {
    clearCalls += 1;
    tokens = null;
  },
};

registerSession(SESSION_SCOPES.STORE, port);

beforeEach(() => {
  tokens = { accessToken: 'T1', refreshToken: 'R1' };
  refreshCalls = 0;
  clearCalls = 0;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('duas chamadas com 401 compartilham um único refresh', async () => {
  const seen: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/customer/refresh')) {
        refreshCalls += 1;
        // Demora o bastante para as duas chamadas coincidirem.
        await new Promise((resolve) => setTimeout(resolve, 20));
        return jsonResponse(200, { accessToken: 'T2', refreshToken: 'R2' });
      }

      const auth = new Headers(init.headers).get('Authorization');
      seen.push(`${url.split('/').pop()}:${auth}`);

      return auth === 'Bearer T2'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, {
            statusCode: 401,
            message: 'Sessão inválida.',
            error: 'Unauthorized',
          });
    }),
  );

  const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);

  expect(a).toEqual({ ok: true });
  expect(b).toEqual({ ok: true });
  expect(refreshCalls).toBe(1);
  expect(tokens?.accessToken).toBe('T2');
  // Cada rota: uma vez com T1 (401) e uma vez com T2 (200).
  expect(seen).toHaveLength(4);
});

test('uma chamada que chega depois do refresh não pede outro', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/customer/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, { accessToken: 'T2', refreshToken: 'R2' });
      }

      const auth = new Headers(init.headers).get('Authorization');

      return auth === 'Bearer T2'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, {
            statusCode: 401,
            message: 'Sessão inválida.',
            error: 'Unauthorized',
          });
    }),
  );

  await api.get('/a');
  expect(refreshCalls).toBe(1);

  // A segunda ja sai com T2 e nem chega a tomar 401.
  await api.get('/b');
  expect(refreshCalls).toBe(1);
});

test('refresh recusado encerra a sessão e o 401 sobe', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/customer/refresh')) {
        refreshCalls += 1;
        return jsonResponse(401, {
          statusCode: 401,
          message: 'Sessão inválida.',
          error: 'Unauthorized',
        });
      }

      return jsonResponse(401, {
        statusCode: 401,
        message: 'Sessão inválida.',
        error: 'Unauthorized',
      });
    }),
  );

  await expect(api.get('/a')).rejects.toMatchObject({ status: 401 });
  expect(refreshCalls).toBe(1);
  expect(clearCalls).toBe(1);
  expect(tokens).toBeNull();
});

test('rota publica com 401 não tenta renovar nada', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/customer/refresh')) {
        refreshCalls += 1;
      }

      return jsonResponse(401, {
        statusCode: 401,
        message: 'Não autorizado.',
        error: 'Unauthorized',
      });
    }),
  );

  await expect(api.get('/products', { scope: null })).rejects.toMatchObject({ status: 401 });
  expect(refreshCalls).toBe(0);
});
