import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { ADMIN_RATE_LIMIT, PUBLIC_RATE_LIMIT } from './rate-limit.constants.js';
import { RATE_LIMIT_KEY } from './rate-limit.decorator.js';
import type { RateLimitRule } from './rate-limit.decorator.js';

/**
 * Qual regra vale para esta rota.
 *
 * Tres camadas, da mais especifica para a mais geral: o `@RateLimit()` da
 * rota, o teto das rotas abertas e o teto do painel. A ultima decisao e feita
 * pelo `@Public()` porque ele ja marca exatamente essa fronteira — rota aberta
 * na internet de um lado, rota que exige credencial do outro —, e inventar um
 * segundo decorador para dizer a mesma coisa criaria a chance de os dois
 * discordarem.
 *
 * Nenhuma rota fica sem teto. Antes disso o limite era opcional e valia so
 * onde alguem lembrou de liga-lo; agora esquecer o decorador significa herdar
 * o teto da categoria, nao ficar sem nenhum.
 */
export function resolveRateLimitRule(
  reflector: Reflector,
  context: ExecutionContext,
): RateLimitRule {
  const targets = [context.getHandler(), context.getClass()];
  const declared = reflector.getAllAndOverride<RateLimitRule | undefined>(
    RATE_LIMIT_KEY,
    targets,
  );

  if (declared) {
    return declared;
  }

  return reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)
    ? PUBLIC_RATE_LIMIT
    : ADMIN_RATE_LIMIT;
}

/**
 * A chave do contador: SHA-256 de `escopo|identidade`.
 *
 * O hash nao protege segredo nenhum — o escopo e publico e o IP e conhecido de
 * quem chama. Ele existe para que a colecao de rate limit nao vire um registro
 * de quem visitou a loja, e para caber no campo de 64 caracteres do schema
 * seja qual for a identidade (IP, telefone, IPv6 longo).
 */
export function rateLimitKey(scope: string, identity: string): string {
  return createHash('sha256').update(`${scope}|${identity}`).digest('hex');
}
