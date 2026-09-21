import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { TOO_MANY_REQUESTS_MESSAGE } from './rate-limit.constants.js';
import type { RateLimitRule } from './rate-limit.decorator.js';
import { rateLimitKey } from './rate-limit.rule.js';

/** A regra somada a quem esta chamando — o IP na rota, o telefone no pedido. */
export interface RateLimitInput extends RateLimitRule {
  identity: string;
}

/**
 * O mesmo contador do guard, para quem precisa limitar por algo que nao e o
 * IP.
 *
 * O caso que existe hoje e o pedido: o limite por IP fica no guard, mas o
 * limite por telefone so pode ser conferido depois que o numero foi
 * normalizado, ja dentro do servico. Sao os dois lados do mesmo flood — a
 * mesma maquina insistindo e o mesmo cliente chegando de outra.
 *
 * Recebe o armazenamento pelo token do throttler, e nao pela classe: assim e
 * literalmente o mesmo objeto que o guard usa, e nao ha como as duas contagens
 * divergirem um dia.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage) {}

  /** Conta mais uma chamada e lanca 429 quando ela passa do teto. */
  async consume(input: RateLimitInput): Promise<void> {
    const windowMs = input.windowSeconds * 1000;
    const record = await this.storage.increment(
      rateLimitKey(input.scope, input.identity),
      windowMs,
      input.limit,
      windowMs,
      input.scope,
    );

    if (record.isBlocked) {
      throw new HttpException(TOO_MANY_REQUESTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
