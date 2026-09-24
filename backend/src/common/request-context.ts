import { AsyncLocalStorage } from 'node:async_hooks';

/** O que atravessa a requisição inteira sem ser passado de mão em mão. */
interface RequestScope {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestScope>();

/**
 * Abre o escopo da requisição.
 *
 * `AsyncLocalStorage` e o único jeito de o log de um serviço no fundo da pilha
 * saber a qual requisição ele pertence sem que `requestId` vire parâmetro de
 * toda função do projeto. Em função serverless a economia e maior ainda: uma
 * instância atende várias requisições em sequência, e uma variável de módulo
 * misturaria os identificadores da anterior com os da atual.
 */
export function runWithRequestId(requestId: string, next: () => void): void {
  storage.run({ requestId }, next);
}

/**
 * O identificador da requisição em curso, quando há uma.
 *
 * `undefined` fora de requisição — no boot, num seed, num script — e isso não
 * e erro: nem toda linha de log nasce de alguém chamando a API.
 */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
