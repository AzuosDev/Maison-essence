import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { resolveClientIp } from '../../common/client-ip.js';
import { RATE_LIMIT_KEY } from './rate-limit.decorator.js';
import type { RateLimitRule } from './rate-limit.decorator.js';
import { RateLimitService } from './rate-limit.service.js';

/**
 * Aplica a regra declarada por `@RateLimit()` usando o IP de quem chamou.
 *
 * Nao e `APP_GUARD`: o limite e caso a caso, e um guard global que consultasse
 * metadado em toda rota do painel so gastaria tempo para concluir que nao ha
 * regra. Entra com `@UseGuards` no controller que precisa dele.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    await this.limits.consume({ ...rule, identity: resolveClientIp(request) });

    return true;
  }
}
