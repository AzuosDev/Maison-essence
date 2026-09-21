import { STATUS_CODES } from 'node:http';

export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  /**
   * Dados que a recusa precisa carregar alem do texto. Vem de quem lancou a
   * excecao, e so quando ha o que dizer: o 409 de excluir categoria manda
   * quantos produtos estao vinculados, e o painel monta o aviso com o numero
   * sem ter que extrai-lo da frase.
   */
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

/** O corpo de erro sem os dois campos que todo erro tem igual. */
export type ErrorContent = Pick<ErrorResponseBody, 'statusCode' | 'message'> &
  Partial<Pick<ErrorResponseBody, 'error' | 'details'>>;

/**
 * O formato unico de erro da API.
 *
 * Mora aqui, e nao no filtro de excecoes, porque nem toda recusa passa por
 * ele: o que barra operador do Mongo no corpo responde antes do Nest entrar em
 * cena (ver `mongo-operator-guard.ts`), e quem consome a API nao tem por que
 * receber dois formatos de erro dependendo de onde a recusa nasceu.
 */
export function errorResponseBody(content: ErrorContent, path: string): ErrorResponseBody {
  return {
    statusCode: content.statusCode,
    message: content.message,
    error: content.error ?? reasonPhrase(content.statusCode),
    ...(content.details ? { details: content.details } : {}),
    timestamp: new Date().toISOString(),
    path,
  };
}

export function reasonPhrase(statusCode: number): string {
  return STATUS_CODES[statusCode] ?? 'Error';
}
