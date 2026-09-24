import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_RATE_LIMIT, PUBLIC_RATE_LIMIT } from './rate-limit.constants.js';
import { rateLimitKey, resolveRateLimitRule } from './rate-limit.rule.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { RATE_LIMIT_KEY } from './rate-limit.decorator.js';

/** Um contexto de rota, com os metadados que o decorator teria deixado. */
function contextWith(metadata: Record<string, unknown>): ExecutionContext {
  const handler = (): void => undefined;

  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class Anonymous {},
  } as unknown as ExecutionContext;
}

describe('resolveRateLimitRule', () => {
  const reflector = new Reflector();

  it('usa a regra que a rota declarou', () => {
    const declared = { scope: 'auth-login', limit: 5, windowSeconds: 900 };

    expect(resolveRateLimitRule(reflector, contextWith({ [RATE_LIMIT_KEY]: declared }))).toBe(
      declared,
    );
  });

  it('rota aberta sem regra herda o teto público', () => {
    expect(resolveRateLimitRule(reflector, contextWith({ [IS_PUBLIC_KEY]: true }))).toBe(
      PUBLIC_RATE_LIMIT,
    );
  });

  it('rota sem marcação nenhuma e do painel: nenhuma rota fica sem teto', () => {
    expect(resolveRateLimitRule(reflector, contextWith({}))).toBe(ADMIN_RATE_LIMIT);
  });
});

describe('rateLimitKey', () => {
  it('separa os contadores por escopo, para o mesmo IP', () => {
    expect(rateLimitKey('auth-login', '203.0.113.10')).not.toBe(
      rateLimitKey('public', '203.0.113.10'),
    );
  });

  it('cabe no campo do schema e não carrega o IP em texto', () => {
    const key = rateLimitKey('public', '203.0.113.10');

    expect(key).toHaveLength(64);
    expect(key).not.toContain('203.0.113.10');
  });
});
