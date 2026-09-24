/**
 * A porta de entrada da API.
 *
 * Importe daqui — `import { api } from '@/lib/http'` — e nunca dos arquivos
 * internos. E o que mantem a regra de pé: existe um cliente HTTP nesta
 * aplicação, e ele e este.
 */

export {
  ApiError,
  NetworkError,
  errorMessage,
  isApiError,
  isNetworkError,
  type ApiErrorBody,
} from './api-error';

export {
  api,
  apiRequest,
  type HttpMethod,
  type QueryParams,
  type QueryValue,
  type RequestOptions,
} from './client';

export {
  SESSION_SCOPES,
  registerSession,
  sessionFor,
  type SessionPort,
  type SessionScope,
  type SessionTokens,
} from './session';
