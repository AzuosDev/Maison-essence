import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { resolveClientIp } from '../../common/client-ip.js';
import { TOO_MANY_REQUESTS_MESSAGE } from './rate-limit.constants.js';
import { rateLimitKey, resolveRateLimitRule } from './rate-limit.rule.js';
import { RateLimitStorage } from './rate-limit.storage.js';

/**
 * O limite de chamadas da API inteira.
 *
 * Entra como `APP_GUARD` e vale para toda rota: o limite deixou de ser algo
 * que alguém liga onde lembrou e passou a ser o piso da API, com as rotas
 * declarando só o que foge do padrão (ver `resolveRateLimitRule`).
 *
 * Fica antes dos guards de autenticação na ordem global, e isso importa: a
 * tentativa de login errada precisa ser contada, e ela nunca passa do primeiro
 * guard.
 *
 * Isto já foi uma subclasse do `ThrottlerGuard`. O pacote saiu do projeto
 * porque e CommonJS e o Nest 12 e ESM puro — o runtime da Vercel recusa o
 * `require()` de um pelo outro, e a função nem chegava a subir. O que se
 * herdava dele são as trinta linhas abaixo; o contador sempre foi nosso.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly storage: RateLimitStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Só HTTP tem endereço de quem chamou e cabeçalho onde responder. Esta API
    // não expõe outro transporte, e se um dia expuser, o limite dele precisa
    // ser pensado — não herdado por acidente.
    if (context.getType() !== 'http') {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const rule = resolveRateLimitRule(this.reflector, context);

    // Quem esta chamando, visto de dentro de uma função serverless: `req.ip` e
    // sempre o endereço do proxy da Vercel — um balde único para o mundo
    // inteiro. Quem importa esta no `x-forwarded-for`, e `resolveClientIp` e o
    // mesmo leitor que o resto da API usa.
    const tracker = resolveClientIp(request);
    // A chave e a do escopo da regra, e não a da rota: todas as rotas abertas
    // dividem o orçamento público, todas as do painel dividem o
    // administrativo, e as que declaram `@RateLimit()` tem o seu — que e o que
    // permite ao login contar cinco tentativas somando as duas portas por onde
    // ele entra.
    const record = await this.storage.increment(
      rateLimitKey(rule.scope, tracker),
      rule.windowSeconds * 1000,
      rule.limit,
    );

    response.setHeader('X-RateLimit-Limit', rule.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, rule.limit - record.totalHits));
    response.setHeader('X-RateLimit-Reset', record.timeToExpire);

    if (record.isBlocked) {
      // `Retry-After` diz quando voltar; a resposta em si não diz quanto já
      // foi gasto nem qual regra estourou. Qualquer um desses números ajuda a
      // calibrar o próximo laço.
      response.setHeader('Retry-After', record.timeToBlockExpire);

      throw new HttpException(TOO_MANY_REQUESTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
