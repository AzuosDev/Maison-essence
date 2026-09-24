import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';
import { USER_ROLES } from '../enums/user-role.js';
import type { UserRole } from '../enums/user-role.js';
import { MANAGES_STORE } from '../roles.js';
import { RolesGuard } from './roles.guard.js';

function buildContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(required: UserRole[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;

  return new RolesGuard(reflector);
}

function user(role: UserRole): AuthenticatedUser {
  return {
    id: 'id',
    name: 'Fulano',
    email: 'fulano@maisonessence.com',
    role,
    isActive: true,
    mustChangePassword: false,
    credentialVersion: 1,
    lastLoginAt: null,
  };
}

describe('RolesGuard', () => {
  it('rota sem @Roles exige apenas autenticação', () => {
    expect(buildGuard(undefined).canActivate(buildContext(user(USER_ROLES.STAFF)))).toBe(true);
  });

  it('libera o papel listado', () => {
    const guard = buildGuard([...MANAGES_STORE]);

    expect(guard.canActivate(buildContext(user(USER_ROLES.OWNER)))).toBe(true);
  });

  it('libera o SUPER_ADMIN mesmo fora da lista', () => {
    const guard = buildGuard([...MANAGES_STORE]);

    expect(guard.canActivate(buildContext(user(USER_ROLES.SUPER_ADMIN)))).toBe(true);
  });

  it('recusa o papel fora da lista', () => {
    const guard = buildGuard([...MANAGES_STORE]);

    expect(() => guard.canActivate(buildContext(user(USER_ROLES.STAFF)))).toThrow(
      ForbiddenException,
    );
  });

  it('recusa quando não há usuário: rota com @Roles e @Public e configuração errada', () => {
    const guard = buildGuard([...MANAGES_STORE]);

    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });
});
