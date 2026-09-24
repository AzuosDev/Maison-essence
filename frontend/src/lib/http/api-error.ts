/**
 * O erro da API, com o formato unico que o backend devolve.
 *
 * Toda recusa da API chega em `{ statusCode, message, error, details,
 * timestamp, path }` — o `AllExceptionsFilter` garante isso ate para o que
 * falha antes do Nest entrar em cena. Traduzir esse corpo para uma excecao
 * tipada, aqui, e o que permite a tela perguntar `error.status === 409` em
 * vez de vasculhar JSON no meio de um `catch`.
 */

/** O corpo de erro da API, como `common/error-response.ts` o monta. */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

export class ApiError extends Error {
  /** O status HTTP. `422` e `409` sao os que as telas costumam tratar. */
  readonly status: number;

  /**
   * Todas as mensagens, sempre como lista.
   *
   * O `ValidationPipe` devolve um array com um item por campo invalido, e o
   * resto da API devolve uma frase so. Normalizar aqui evita o
   * `Array.isArray(message)` repetido em cada formulario.
   */
  readonly messages: string[];

  /**
   * O que a recusa carrega alem do texto — o 409 de excluir categoria manda
   * quantos produtos estao vinculados, por exemplo. `null` quando nao ha.
   */
  readonly details: Record<string, unknown> | null;

  /** O caminho chamado, para o log e para a mensagem de suporte. */
  readonly path: string;

  constructor(status: number, messages: string[], path: string, body: ApiErrorBody | null) {
    super(messages[0] ?? `A requisição falhou com status ${status}.`);

    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.details = body?.details ?? null;
    this.path = path;
  }

  /** `401` e `403`: a sessao acabou ou a area nao e de quem esta logado. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Erro do servidor, e nao do que foi enviado: vale a pena tentar de novo. */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * A requisicao nem chegou a ter resposta: sem rede, DNS fora, CORS recusado
 * ou tempo esgotado.
 *
 * Separada do `ApiError` de proposito — nao ha status nem corpo para ler, e a
 * tela mostra "sem conexao", nao "algo deu errado no servidor".
 */
export class NetworkError extends Error {
  readonly path: string;

  /** `true` quando quem cancelou foi o tempo limite, e nao o usuario. */
  readonly timedOut: boolean;

  constructor(path: string, timedOut: boolean, cause?: unknown) {
    super(
      timedOut
        ? 'O servidor demorou demais para responder. Tente novamente.'
        : 'Não foi possível falar com o servidor. Confira sua conexão.',
    );

    this.name = 'NetworkError';
    this.path = path;
    this.timedOut = timedOut;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * A frase que a tela mostra, venha o erro de onde vier.
 *
 * A mensagem da API ja chega em portugues e escrita para quem vai ler — e a
 * dona quem le o painel e o cliente quem le a loja. O texto generico e o
 * ultimo recurso, para o que nao e nenhum dos dois erros conhecidos.
 */
export function errorMessage(error: unknown): string {
  if (isApiError(error) || isNetworkError(error)) {
    return error.message;
  }

  return 'Algo deu errado. Tente novamente em instantes.';
}
