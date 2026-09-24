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
 * O mesmo contador do guard, para quem precisa limitar por algo que não e o
 * IP.
 *
 * O caso que existe hoje e o pedido: o limite por IP fica no guard, mas o
 * limite por telefone só pode ser conferido depois que o número foi
 * normalizado, já dentro do serviço. São os dois lados do mesmo flood — a
 * mesma máquina insistindo e o mesmo cliente chegando de outra.
 *
 * Recebe o armazenamento pelo token do throttler, e não pela classe: assim e
 * literalmente o mesmo objeto que o guard usa, e não há como as duas contagens
 * divergirem um dia.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage) {}

  /** Conta mais uma chamada e lança 429 quando ela passa do teto. */
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
