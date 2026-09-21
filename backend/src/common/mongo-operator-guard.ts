import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { errorResponseBody } from './error-response.js';

/**
 * Quantos niveis do corpo sao percorridos.
 *
 * O corpo ja chega limitado a 256 KB, mas 256 KB de colchetes aninhados sao
 * cem mil niveis, e uma travessia recursiva estouraria a pilha — ou seja, um
 * 500 de presente para quem mandar o corpo certo. A travessia aqui e iterativa
 * e ainda assim para no teto: nada neste dominio tem dez niveis de
 * profundidade, e o que tiver merece ser recusado.
 */
const MAX_DEPTH = 10;

export const MONGO_OPERATOR_MESSAGE =
  'O corpo da requisicao tem um campo com nome invalido.';

/** Diz qual campo reprovou, para o erro de integracao ser corrigivel. */
export function forbiddenKeyMessage(key: string): string {
  return `${MONGO_OPERATOR_MESSAGE} Nome recusado: "${key}".`;
}

/**
 * Procura no corpo uma chave que o Mongo leria como instrucao.
 *
 * Duas formas importam. A chave iniciada por cifrao e um operador —
 * `{"email": {"$ne": null}}` num filtro devolve o primeiro usuario que existir,
 * e `{"$set": ...}` numa atualizacao escreve onde quiser. A chave com ponto e
 * um caminho — `{"role.0": "SUPER_ADMIN"}` alcanca dentro de um documento que
 * o codigo achava que estava tratando como valor.
 *
 * Nada disso passa pelos DTOs, que ja descartam o que nao conhecem. A defesa
 * aqui e para o que nao passa por DTO: a consulta montada a partir de um
 * objeto, o `updateOne` que recebe um bloco inteiro, e o proximo endpoint que
 * alguem escrever sem lembrar da regra. Recusar na porta custa uma travessia
 * por requisicao e nao depende de cada rota estar certa.
 *
 * Devolve o nome da chave reprovada, ou `null` quando o corpo esta limpo.
 */
export function findForbiddenKey(body: unknown): string | null {
  const pending: { value: unknown; depth: number }[] = [{ value: body, depth: 0 }];

  while (pending.length > 0) {
    const { value, depth } = pending.pop() as { value: unknown; depth: number };

    if (typeof value !== 'object' || value === null || depth > MAX_DEPTH) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        pending.push({ value: item, depth: depth + 1 });
      }

      continue;
    }

    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        return key;
      }

      pending.push({ value: inner, depth: depth + 1 });
    }
  }

  return null;
}

/**
 * Recusa com 400 o corpo que carrega operador do Mongo.
 *
 * Entra como middleware do Express, depois do parser e antes das rotas: assim
 * vale para toda rota da API, inclusive as que nao declaram DTO, e vale
 * tambem para o corpo que nenhum controller chega a ler.
 */
export function rejectMongoOperators(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const forbidden = findForbiddenKey(request.body);

    if (forbidden === null) {
      next();

      return;
    }

    // originalUrl preserva o prefixo global, que o Express remove de req.url.
    const path = request.originalUrl || request.url;

    response.status(HttpStatus.BAD_REQUEST).json(
      errorResponseBody(
        { statusCode: HttpStatus.BAD_REQUEST, message: forbiddenKeyMessage(forbidden) },
        path,
      ),
    );
  };
}
