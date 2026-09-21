import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import type { CdnCacheOptions } from '../cache-control.js';
import { CDN_CACHE_KEY, cacheControlOf } from '../cache-control.js';

/**
 * Escreve o `Cache-Control` das rotas marcadas com `@CdnCache()`.
 *
 * Global, mas inerte por padrao: so age onde o decorator existe. O cabecalho
 * e escrito depois do handler, e nao antes, para que uma resposta de erro nao
 * saia cacheavel — um 404 guardado por cinco minutos na CDN esconde o produto
 * que acabou de ser publicado.
 */
@Injectable()
export class CdnCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<CdnCacheOptions | undefined>(
      CDN_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        context
          .switchToHttp()
          .getResponse<Response>()
          .setHeader('Cache-Control', cacheControlOf(options));
      }),
    );
  }
}
