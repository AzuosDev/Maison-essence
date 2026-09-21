import { QueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError } from '@/lib/http';

/**
 * O cache de dados do servidor.
 *
 * As escolhas aqui valem para a aplicacao inteira; uma tela so muda o que
 * tiver motivo proprio para mudar.
 */

/**
 * Quanto tempo um dado e considerado fresco.
 *
 * Um minuto para tudo, porque quase tudo nesta loja e catalogo: nome, foto e
 * preco de perfume nao mudam enquanto alguem navega. O que precisa de outro
 * numero pede explicitamente — a cotacao do carrinho, por exemplo, que nao
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

        // Voltar para a aba nao precisa recarregar o catalogo. Quem quiser
        // esse comportamento — uma lista de pedidos no painel, que muda
        // enquanto a dona atende — liga na propria consulta.
        refetchOnWindowFocus: false,

        retry: shouldRetry,

        // Espera crescente com teto: 1s, 2s — e nao a rajada que so piora um
        // servidor que ja esta em dificuldade.
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },

      mutations: {
        // Mutacao nao se repete sozinha: criar um pedido duas vezes por causa
        // de uma resposta lenta e pior que mostrar o erro e deixar a pessoa
        // decidir. Quem quiser retentativa pede por mutacao.
        retry: false,
      },
    },
  });
}

/**
 * O que vale a pena tentar de novo.
 *
 * Erro de rede e `5xx` sao transitorios — a funcao serverless pode ter
 * acordado devagar, o tunel pode ter engolido a requisicao. Ja um `404` ou um
 * `422` vao responder exatamente a mesma coisa na segunda tentativa, e um
 * `401` ja teve a sua renovacao no cliente HTTP: insistir so atrasa a tela
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
