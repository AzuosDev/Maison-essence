import { AsyncLocalStorage } from 'node:async_hooks';

/** O que atravessa a requisicao inteira sem ser passado de mao em mao. */
interface RequestScope {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestScope>();

/**
 * Abre o escopo da requisicao.
 *
 * `AsyncLocalStorage` e o unico jeito de o log de um servico no fundo da pilha
 * saber a qual requisicao ele pertence sem que `requestId` vire parametro de
 * toda funcao do projeto. Em funcao serverless a economia e maior ainda: uma
 * instancia atende varias requisicoes em sequencia, e uma variavel de modulo
 * misturaria os identificadores da anterior com os da atual.
 */
export function runWithRequestId(requestId: string, next: () => void): void {
  storage.run({ requestId }, next);
}

/**
 * O identificador da requisicao em curso, quando ha uma.
 *
 * `undefined` fora de requisicao — no boot, num seed, num script — e isso nao
 * e erro: nem toda linha de log nasce de alguem chamando a API.
 */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
