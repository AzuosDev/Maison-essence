import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AUTH_AUDIENCE_KEY } from '../../../common/decorators/auth-audience.decorator.js';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { ADMIN_ONLY_MESSAGE } from '../auth.constants.js';
import {
  CUSTOMER_ACCESS_TOKEN_COOKIE,
  readBearerToken,
  readCookie,
} from '../../../common/session-cookies.js';
import type { TokenAudience } from '../auth.types.js';
import { TOKEN_AUDIENCES } from '../auth.types.js';
import { TokenService } from '../token.service.js';

/**
 * Autenticacao ligada por padrao em toda rota.
 *
 * Registrado como `APP_GUARD`: rota nova nasce protegida e so abre com
 * `@Public()` explicito. O contrario — proteger rota a rota — e onde mais se
 * esquece de uma.
 *
 * Rotas marcadas com a audiencia da loja passam direto por aqui, e nao porque
 * sejam abertas: quem as autentica e o guard do cliente, declarado nelas. Este
 * guard cuida das credenciais do painel.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const audience = this.reflector.getAllAndOverride<TokenAudience | undefined>(
      AUTH_AUDIENCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (audience === TOKEN_AUDIENCES.CUSTOMER) {
      return true;
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  /**
   * Distingue "credencial invalida" de "credencial da loja em area de painel".
   *
   * So roda quando a autenticacao do painel ja falhou. Se o que veio e um
   * access token de cliente legitimo, a resposta certa e 403: a credencial e
   * boa, o lugar e que nao e dela, e 401 mandaria o frontend tentar renovar
   * uma sessao que nunca vai servir para esta rota — um laco de renovacao que
   * so termina no logout.
   *
   * Nenhuma claim de cliente e usada para conceder coisa alguma aqui; o token
   * e verificado por inteiro, e o unico efeito e a escolha do status.
   */
  override handleRequest<TUser>(
    _error: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (user) {
      return user;
    }

    // `canActivate` do `AuthGuard` faz `await` no retorno deste metodo, entao
    // devolver uma promessa aqui funciona em tempo de execucao — a assinatura
    // da interface e que e sincrona. O cast e o preco de conferir o token, que
    // e assincrono; a promessa devolvida so rejeita.
    return this.reject(context) as TUser;
  }

  /** Escolhe entre 401 e 403 e lanca. Nunca devolve valor. */
  private async reject(context: ExecutionContext): Promise<never> {
    const request = context.switchToHttp().getRequest<Request>();

    // Dois lugares porque sao dois caminhos reais: o navegador da loja manda o
    // cookie proprio em qualquer rota do prefixo, e quem usa a API sem cookie
    // manda o mesmo token no `Authorization`.
    const candidates = [
      readCookie(request, CUSTOMER_ACCESS_TOKEN_COOKIE),
      readBearerToken(request),
    ];

    for (const token of candidates) {
      if (token !== null && (await this.tokens.readCustomerAccessToken(token)) !== null) {
        throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
      }
    }

    throw new UnauthorizedException();
  }
}
