import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PASSWORD_CHANGE_REQUIRED_MESSAGE } from '../auth.constants.js';
import type { AuthenticatedUser } from '../auth.types.js';
import { ALLOW_PENDING_PASSWORD_KEY } from '../decorators/allow-pending-password.decorator.js';

/**
 * Senha temporaria nao da acesso ao painel.
 *
 * O login funciona e o access token sai com `mustChangePassword`, mas toda
 * rota administrativa responde 403 ate a troca. As excecoes sao marcadas com
 * `@AllowPendingPassword()`.
 *
 * Roda depois do `JwtAuthGuard` (ordem de registro no modulo), entao aqui o
 * usuario ja esta no request; rota publica passa direto por nao ter usuario.
 */
@Injectable()
export class PendingPasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_PENDING_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowed) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!request.user?.mustChangePassword) {
      return true;
    }

    throw new ForbiddenException(PASSWORD_CHANGE_REQUIRED_MESSAGE);
  }
}
