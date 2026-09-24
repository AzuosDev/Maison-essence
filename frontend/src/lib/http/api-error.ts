/**
 * O erro da API, com o formato único que o backend devolve.
 *
 * Toda recusa da API chega em `{ statusCode, message, error, details,
 * timestamp, path }` — o `AllExceptionsFilter` garante isso até para o que
 * falha antes do Nest entrar em cena. Traduzir esse corpo para uma exceção
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
  /** O status HTTP. `422` e `409` são os que as telas costumam tratar. */
  readonly status: number;

  /**
   * Todas as mensagens, sempre como lista.
   *
   * O `ValidationPipe` devolve um array com um item por campo inválido, e o
   * resto da API devolve uma frase só. Normalizar aqui evita o
   * `Array.isArray(message)` repetido em cada formulário.
   */
  readonly messages: string[];

  /**
   * O que a recusa carrega além do texto — o 409 de excluir categoria manda
   * quantos produtos estão vinculados, por exemplo. `null` quando não há.
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

  /** `401` e `403`: a sessão acabou ou a área não e de quem esta logado. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Erro do servidor, e não do que foi enviado: vale a pena tentar de novo. */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * A requisição nem chegou a ter resposta: sem rede, DNS fora, CORS recusado
 * ou tempo esgotado.
 *
 * Separada do `ApiError` de propósito — não há status nem corpo para ler, e a
 * tela mostra "sem conexão", não "algo deu errado no servidor".
 */
export class NetworkError extends Error {
  readonly path: string;

  /** `true` quando quem cancelou foi o tempo limite, e não o usuário. */
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
 * A mensagem da API já chega em português e escrita para quem vai ler — e a
 * dona quem lê o painel e o cliente quem lê a loja. O texto genérico e o
 * último recurso, para o que não e nenhum dos dois erros conhecidos.
 */
export function errorMessage(error: unknown): string {
  if (isApiError(error) || isNetworkError(error)) {
    return error.message;
  }

  return 'Algo deu errado. Tente novamente em instantes.';
}
