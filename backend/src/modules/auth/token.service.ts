import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import type {
  AccessTokenPayload,
  CustomerAccessTokenPayload,
  RefreshTokenPayload,
  TokenAudience,
} from './auth.types.js';
import { TOKEN_AUDIENCES, TOKEN_TYPES } from './auth.types.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

/** O minimo que um access token de cliente precisa saber da conta. */
export interface CustomerPrincipal {
  id: string;
  credentialVersion: number;
}

/**
 * Assina e confere os tokens das duas audiencias.
 *
 * Cada token tem o seu segredo, passado explicitamente na chamada em vez de
 * registrado no `JwtModule`: com um segredo global seria facil assinar o
 * refresh com a chave do access sem ninguem notar, e ai um refresh token
 * passaria pelo guard como se fosse access.
 *
 * Painel e loja compartilham este servico de proposito — e a mesma mecanica de
 * assinatura, expiracao e rotacao, e duas implementacoes dela divergiriam na
 * primeira correcao. O que nao compartilham e nada que de acesso: segredo,
 * audiencia e tempo de vida sao proprios de cada lado, e a verificacao exige
 * os tres. Um token de cliente apresentado ao painel falha na assinatura antes
 * mesmo de alguem olhar as claims.
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
      secret: this.secret(TOKEN_AUDIENCES.ADMIN, TOKEN_TYPES.ACCESS),
      audience: TOKEN_AUDIENCES.ADMIN,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  /** O access token da loja. Sem papel, sem e-mail: so a conta e a versao. */
  signCustomerAccessToken(customer: CustomerPrincipal): Promise<string> {
    const payload: CustomerAccessTokenPayload = {
      sub: customer.id,
      credentialVersion: customer.credentialVersion,
      type: TOKEN_TYPES.ACCESS,
    };

    return this.jwt.signAsync(payload, {
      secret: this.secret(TOKEN_AUDIENCES.CUSTOMER, TOKEN_TYPES.ACCESS),
      audience: TOKEN_AUDIENCES.CUSTOMER,
      expiresIn: CUSTOMER_ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  signRefreshToken(
    ownerId: string,
    tokenId: string,
    audience: TokenAudience = TOKEN_AUDIENCES.ADMIN,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: ownerId,
      jti: tokenId,
      type: TOKEN_TYPES.REFRESH,
    };

    return this.jwt.signAsync(payload, {
      secret: this.secret(audience, TOKEN_TYPES.REFRESH),
      audience,
      expiresIn: refreshTtlOf(audience),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.verify<AccessTokenPayload>(
      token,
      TOKEN_AUDIENCES.ADMIN,
      TOKEN_TYPES.ACCESS,
    );

    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException('Token invalido.');
    }

    return payload;
  }

  async verifyCustomerAccessToken(token: string): Promise<CustomerAccessTokenPayload> {
    const payload = await this.verify<CustomerAccessTokenPayload>(
      token,
      TOKEN_AUDIENCES.CUSTOMER,
      TOKEN_TYPES.ACCESS,
    );

    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedException('Token invalido.');
    }

    return payload;
  }

  async verifyRefreshToken(
    token: string,
    audience: TokenAudience = TOKEN_AUDIENCES.ADMIN,
  ): Promise<RefreshTokenPayload> {
    const payload = await this.verify<RefreshTokenPayload>(
      token,
      audience,
      TOKEN_TYPES.REFRESH,
    );

    if (payload.type !== TOKEN_TYPES.REFRESH || !payload.jti) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    return payload;
  }

  /**
   * Diz se o token e um access token de cliente valido, sem lancar.
   *
   * Serve a duas perguntas que nao sao autenticacao. O guard do painel a usa
   * para distinguir "credencial invalida" de "credencial da loja em area de
   * painel"; o checkout a usa para reconhecer o cliente logado sem nunca
   * exigir que ele esteja. Nos dois casos, resposta negativa nao e erro.
   */
  async readCustomerAccessToken(
    token: string,
  ): Promise<CustomerAccessTokenPayload | null> {
    try {
      return await this.verifyCustomerAccessToken(token);
    } catch {
      return null;
    }
  }

  private async verify<T extends object>(
    token: string,
    audience: TokenAudience,
    kind: 'access' | 'refresh',
  ): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, {
        secret: this.secret(audience, kind),
        audience,
      });
    } catch {
      // Assinatura invalida, audiencia errada, token expirado e token
      // adulterado caem todos aqui, e todos respondem a mesma coisa: nada do
      // que o jsonwebtoken diz no erro interessa a quem chamou.
      throw new UnauthorizedException('Sessao invalida.');
    }
  }

  /** O segredo de cada combinacao de audiencia e tipo de token. */
  private secret(audience: TokenAudience, kind: 'access' | 'refresh'): string {
    if (audience === TOKEN_AUDIENCES.CUSTOMER) {
      return kind === TOKEN_TYPES.ACCESS
        ? this.config.get('JWT_CUSTOMER_ACCESS_SECRET', { infer: true })
        : this.config.get('JWT_CUSTOMER_REFRESH_SECRET', { infer: true });
    }

    return kind === TOKEN_TYPES.ACCESS
      ? this.config.get('JWT_ACCESS_SECRET', { infer: true })
      : this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }
}

/**
 * A sessao da loja dura mais que a do painel.
 *
 * Quem compra volta semanas depois e nao tem senha no gerenciador: pedir login
 * de novo a cada sete dias e o tipo de atrito que faz o cliente fechar a aba e
 * mandar mensagem no WhatsApp. O painel e o contrario — a sessao curta e
 * barata para quem entra todo dia e cara para quem roubou o token.
 */
function refreshTtlOf(audience: TokenAudience): number {
  return audience === TOKEN_AUDIENCES.CUSTOMER
    ? CUSTOMER_REFRESH_TOKEN_TTL_SECONDS
    : REFRESH_TOKEN_TTL_SECONDS;
}
