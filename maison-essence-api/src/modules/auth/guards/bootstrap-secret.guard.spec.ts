import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { BOOTSTRAP_SECRET_HEADER, BootstrapSecretGuard } from './bootstrap-secret.guard.js';

const SECRET = 'segredo-de-bootstrap-com-32-caracteres';

function buildContext(header?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        get: (name: string) => (name === BOOTSTRAP_SECRET_HEADER ? header : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(secret: string | undefined): BootstrapSecretGuard {
  const config = { get: () => secret } as unknown as ConfigService<Env, true>;

  return new BootstrapSecretGuard(config);
}

describe('BootstrapSecretGuard', () => {
  it('libera com o segredo certo', () => {
    expect(buildGuard(SECRET).canActivate(buildContext(SECRET))).toBe(true);
  });

  it('sem BOOTSTRAP_SECRET a rota deixa de existir', () => {
    // 404 e nao 403: depois do primeiro acesso a variavel sai do ambiente, e
    // quem varrer a API nao deve achar sinal de que a rota existiu.
    expect(() => buildGuard(undefined).canActivate(buildContext(SECRET))).toThrow(
      NotFoundException,
    );
  });

  it('recusa sem o header', () => {
    expect(() => buildGuard(SECRET).canActivate(buildContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('recusa o segredo errado, inclusive um prefixo do certo', () => {
    const guard = buildGuard(SECRET);

    expect(() => guard.canActivate(buildContext('outro-segredo'))).toThrow(
      UnauthorizedException,
    );
    // Tamanhos diferentes: o digest iguala o tamanho antes da comparacao, sem
    // o `timingSafeEqual` estourar por buffers desiguais.
    expect(() => guard.canActivate(buildContext(SECRET.slice(0, 20)))).toThrow(
      UnauthorizedException,
    );
  });
});
