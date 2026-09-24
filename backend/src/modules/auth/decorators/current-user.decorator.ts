import { UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types.js';

/**
 * Usuário já resolvido pelo guard. Não vai ao banco: o `JwtStrategy` carregou
 * e validou o registro no mesmo request.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!request.user) {
      // Só acontece se alguém usar o decorator numa rota marcada @Public().
      throw new UnauthorizedException('Autenticação necessária.');
    }

    return request.user;
  },
);
