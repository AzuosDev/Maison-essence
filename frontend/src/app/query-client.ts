import { QueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError } from '@/lib/http';

/**
 * O cache de dados do servidor.
 *
 * As escolhas aqui valem para a aplicação inteira; uma tela só muda o que
 * tiver motivo próprio para mudar.
 */

/**
 * Quanto tempo um dado e considerado fresco.
 *
 * Um minuto para tudo, porque quase tudo nesta loja e catálogo: nome, foto e
 * preço de perfume não mudam enquanto alguém navega. O que precisa de outro
 * número pede explicitamente — a cotação do carrinho, por exemplo, que não
 * pode ser servida de cache nenhum.
 */
const STALE_TIME_MS = 60_000;

/** Quantas vezes tentar de novo antes de mostrar o erro. */
const MAX_RETRIES = 2;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,

        // Voltar para a aba não precisa recarregar o catálogo. Quem quiser
        // esse comportamento — uma lista de pedidos no painel, que muda
        // enquanto a dona atende — liga na própria consulta.
        refetchOnWindowFocus: false,

        retry: shouldRetry,

        // Espera crescente com teto: 1s, 2s — e não a rajada que só piora um
        // servidor que já esta em dificuldade.
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },

      mutations: {
        // Mutação não se repete sozinha: criar um pedido duas vezes por causa
        // de uma resposta lenta e pior que mostrar o erro e deixar a pessoa
        // decidir. Quem quiser retentativa pede por mutação.
        retry: false,
      },
    },
  });
}

/**
 * O que vale a pena tentar de novo.
 *
 * Erro de rede e `5xx` são transitórios — a função serverless pode ter
 * acordado devagar, o tunel pode ter engolido a requisição. Já um `404` ou um
 * `422` vão responder exatamente a mesma coisa na segunda tentativa, e um
 * `401` já teve a sua renovação no cliente HTTP: insistir só atrasa a tela
 * de erro.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }

  if (error instanceof NetworkError) {
    return true;
  }

  if (error instanceof ApiError) {
    return error.isServerError;
  }

  return false;
}
