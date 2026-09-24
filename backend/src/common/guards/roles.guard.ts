import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { UserRole } from '../enums/user-role.js';
import { USER_ROLES } from '../enums/user-role.js';

export const FORBIDDEN_ROLE_MESSAGE = 'Seu papel não permite esta operação.';

/**
 * Autorizacao por papel, global.
 *
 * Roda depois do `JwtAuthGuard`, entao o usuario ja esta no request. Duas
 * regras:
 *
 * - rota sem `@Roles(...)` exige so estar autenticado;
 * - `SUPER_ADMIN` passa em qualquer rota, sem precisar ser listado.
 *
 * O acesso total do `SUPER_ADMIN` fica aqui, e nao repetido em cada lista de
 * papeis, porque a lista onde alguem esquecesse de inclui-lo trancaria o
 * desenvolvedor para fora do sistema — sem ninguem para reabrir.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const role = request.user?.role;

    // Sem usuario em rota com `@Roles`: so acontece se a rota tambem estiver
    // marcada `@Public()`, o que e configuracao errada. Nega.
    if (!role) {
      throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
    }

    if (role === USER_ROLES.SUPER_ADMIN || required.includes(role)) {
      return true;
    }

    throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
  }
}
