import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithRequestId } from './request-context.js';

/** Cabecalho de entrada e de saida. O mesmo nome dos dois lados. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Teto do valor aceito de fora: id e identificador, nao carga. */
const MAX_LENGTH = 64;

/**
 * Da um identificador a requisicao e o deixa disponivel ate o fim dela.
 *
 * Aceita o `x-request-id` que vier de fora porque o frontend e a borda da
 * Vercel ja geram o seu: reaproveitar e o que faz o clique do cliente, a
 * entrada no log da borda e a linha do servico terem o mesmo numero. O valor
 * recebido so e podado no tamanho — ele nao autoriza nada, so identifica, e o
 * pior que um valor inventado faz e confundir quem inventou.
 *
 * Devolve o identificador no cabecalho da resposta para que quem viu o erro na
 * tela consiga dizer qual requisicao foi.
 */
export function attachRequestId(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const received = request.headers[REQUEST_ID_HEADER];
    const incoming = Array.isArray(received) ? received[0] : received;
    const requestId = incoming?.trim().slice(0, MAX_LENGTH) || randomUUID();

    response.setHeader(REQUEST_ID_HEADER, requestId);

    runWithRequestId(requestId, next);
  };
}
