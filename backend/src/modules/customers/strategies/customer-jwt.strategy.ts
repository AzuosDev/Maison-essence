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

/** O nome pelo qual o guard da loja pede esta estratégia ao Passport. */
export const CUSTOMER_JWT_STRATEGY = 'jwt-customer';

/**
 * Valida o access token do cliente.
 *
 * Estratégia separada da do painel, e não um ramo dentro dela: são segredo,
 * audiência e coleção diferentes, e a única forma de um token da loja virar
 * sessão de painel seria alguém juntar os dois caminhos num `if`. Aqui não há
 * esse `if` — o Passport escolhe a estratégia pelo nome que a rota declarou.
 *
 * `audience` entra nas opções da estratégia: um token sem a audiência da loja
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
