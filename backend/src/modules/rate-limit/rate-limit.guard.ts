import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { resolveClientIp } from '../../common/client-ip.js';
import { TOO_MANY_REQUESTS_MESSAGE } from './rate-limit.constants.js';
import { rateLimitKey, resolveRateLimitRule } from './rate-limit.rule.js';

/**
 * O `ThrottlerGuard` com as três decisões que são deste projeto.
 *
 * Entra como `APP_GUARD` e vale para toda rota: o limite deixou de ser algo
 * que alguém liga onde lembrou e passou a ser o piso da API inteira, com as
 * rotas declarando só o que foge do padrão (ver `resolveRateLimitRule`).
 *
 * Fica antes dos guards de autenticação na ordem global, e isso importa: a
 * tentativa de login errada precisa ser contada, e ela nunca passa do primeiro
 * guard.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Quem esta chamando, visto de dentro de uma função serverless.
   *
   * O padrão do throttler e `req.ip`, que na Vercel e sempre o endereço do
   * proxy dela — um único balde para o mundo inteiro. Quem importa esta no
   * `x-forwarded-for`, e `resolveClientIp` e o mesmo leitor que o resto da API
   * usa.
   */
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(resolveClientIp(req as unknown as Request));
  }

  /**
   * A chave do contador vem do escopo da regra, e não da rota.
   *
   * O padrão do throttler junta classe e método na chave, o que da um balde
   * por rota. Aqui o balde e o da regra: todas as rotas abertas dividem o
   * orçamento público, todas as do painel dividem o administrativo, e as que
   * declaram `@RateLimit()` tem o seu próprio — que e o que permite ao login
   * contar cinco tentativas somando as duas portas por onde ele entra.
   */
  protected override generateKey(context: ExecutionContext, tracker: string): string {
    return rateLimitKey(resolveRateLimitRule(this.reflector, context).scope, tracker);
  }

  /**
   * Recusa genérica: sem contador, sem tempo restante e sem dizer qual regra
   * estourou. Qualquer um desses números ajuda a calibrar o próximo laço.
   *
   * O `Retry-After` que o throttler já escreveu no cabeçalho continua lá, para
   * o cliente legitimo que quer se comportar.
   */
  protected override throwThrottlingException(): Promise<void> {
    throw new HttpException(TOO_MANY_REQUESTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
}
