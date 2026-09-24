import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../../config/env.schema.js';
import { User } from '../../users/schemas/user.schema.js';
import { ACCESS_TOKEN_COOKIE } from '../auth.cookies.js';
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types.js';
import { TOKEN_TYPES, toAuthenticatedUser } from '../auth.types.js';

/**
 * Valida o access token de cada request.
 *
 * O token e aceito no cookie ou no `Authorization: Bearer` — nessa ordem,
 * porque o painel usa cookie e o cabecalho e a saida para o cliente que nao
 * recebe cookie cross-site.
 *
 * O `validate` vai ao banco. Custa uma leitura por request e e o preco de
 * `credentialVersion` valer alguma coisa: sem ela, desativar um usuario ou
 * derrubar as sessoes dele so faria efeito quando o token expirasse, ate 15
 * minutos depois.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException('Token inválido.');
    }

    const user = await this.users.findById(payload.sub).exec();

    if (
      !user ||
      !user.isActive ||
      user.credentialVersion !== payload.credentialVersion
    ) {
      // Usuario removido, desativado ou com as credenciais versionadas depois
      // da emissao: o token e valido na assinatura e invalido no conteudo.
      throw new UnauthorizedException('Sessão inválida.');
    }

    return toAuthenticatedUser(user);
  }
}

function extractFromCookie(request: Request): string | null {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;

  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}
