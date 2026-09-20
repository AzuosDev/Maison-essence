import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types.js';
import { TOKEN_TYPES } from './auth.types.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

/**
 * Assina e confere os dois tokens.
 *
 * Cada um tem o seu segredo, passado explicitamente na chamada em vez de
 * registrado no `JwtModule`: com um segredo global seria facil assinar o
 * refresh com a chave do access sem ninguem notar, e ai um refresh token
 * passaria pelo guard como se fosse access.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  signAccessToken(user: UserDocument): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user._id.toHexString(),
      email: user.email,
      role: user.role,
      credentialVersion: user.credentialVersion,
      mustChangePassword: user.mustChangePassword,
      type: TOKEN_TYPES.ACCESS,
    };

    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  signRefreshToken(userId: string, tokenId: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti: tokenId,
      type: TOKEN_TYPES.REFRESH,
    };

    return this.jwt.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.verify<AccessTokenPayload>(token, this.accessSecret);

    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException('Token invalido.');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.verify<RefreshTokenPayload>(token, this.refreshSecret);

    if (payload.type !== TOKEN_TYPES.REFRESH || !payload.jti) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    return payload;
  }

  private async verify<T extends object>(token: string, secret: string): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, { secret });
    } catch {
      // Assinatura invalida, token expirado e token adulterado caem todos
      // aqui, e todos respondem a mesma coisa: nada do que o jsonwebtoken
      // diz no erro interessa a quem chamou.
      throw new UnauthorizedException('Sessao invalida.');
    }
  }

  private get accessSecret(): string {
    return this.config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  private get refreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }
}
