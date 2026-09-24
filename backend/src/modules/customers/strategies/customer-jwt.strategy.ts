import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CUSTOMER_ACCESS_TOKEN_COOKIE, readCookie } from '../../../common/session-cookies.js';
import type { Env } from '../../../config/env.schema.js';
import type { CustomerAccessTokenPayload } from '../../auth/auth.types.js';
import { TOKEN_AUDIENCES, TOKEN_TYPES } from '../../auth/auth.types.js';
import type { AuthenticatedCustomer } from '../customer-auth.types.js';
import { CustomerSessionService } from '../customer-session.service.js';

/** O nome pelo qual o guard da loja pede esta estrategia ao Passport. */
export const CUSTOMER_JWT_STRATEGY = 'jwt-customer';

/**
 * Valida o access token do cliente.
 *
 * Estrategia separada da do painel, e nao um ramo dentro dela: sao segredo,
 * audiencia e colecao diferentes, e a unica forma de um token da loja virar
 * sessao de painel seria alguem juntar os dois caminhos num `if`. Aqui nao ha
 * esse `if` — o Passport escolhe a estrategia pelo nome que a rota declarou.
 *
 * `audience` entra nas opcoes da estrategia: um token sem a audiencia da loja
 * e recusado antes de qualquer consulta ao banco.
 */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  CUSTOMER_JWT_STRATEGY,
) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly sessions: CustomerSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_CUSTOMER_ACCESS_SECRET', { infer: true }),
      audience: TOKEN_AUDIENCES.CUSTOMER,
    });
  }

  async validate(payload: CustomerAccessTokenPayload): Promise<AuthenticatedCustomer> {
    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException('Token inválido.');
    }

    const customer = await this.sessions.loadFromPayload(payload);

    if (customer === null) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return customer;
  }
}

function extractFromCookie(request: Request): string | null {
  return readCookie(request, CUSTOMER_ACCESS_TOKEN_COOKIE);
}
