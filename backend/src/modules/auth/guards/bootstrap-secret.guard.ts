import { CanActivate, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../../config/env.schema.js';

export const BOOTSTRAP_SECRET_HEADER = 'x-bootstrap-secret';
export const BOOTSTRAP_UNAUTHORIZED_MESSAGE = 'Segredo de bootstrap inválido.';

/**
 * Porteiro de `POST /auth/bootstrap`.
 *
 * Sem `BOOTSTRAP_SECRET` no ambiente a rota responde **404**, e nao 403: uma
 * vez removida a variavel — que e o que o README manda fazer depois do
 * primeiro acesso — a rota deixa de existir para quem estiver do lado de fora
 * procurando por ela.
 *
 * A comparacao passa por SHA-256 antes do `timingSafeEqual` por dois motivos:
 * a funcao exige buffers do mesmo tamanho, e comparar o digest impede que o
 * tamanho da resposta entregue o tamanho do segredo.
 */
@Injectable()
export class BootstrapSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get('BOOTSTRAP_SECRET', { infer: true });

    if (!secret) {
      throw new NotFoundException();
    }

    const provided = context.switchToHttp().getRequest<Request>().get(BOOTSTRAP_SECRET_HEADER);

    if (!provided || !matches(provided, secret)) {
      throw new UnauthorizedException(BOOTSTRAP_UNAUTHORIZED_MESSAGE);
    }

    return true;
  }
}

function matches(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
