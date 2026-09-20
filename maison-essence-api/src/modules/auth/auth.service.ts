import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_MIN_DURATION_MS,
} from './auth.constants.js';
import type { AuthSession } from './auth.types.js';
import { toAuthenticatedUser } from './auth.types.js';
import { withMinimumDuration } from './constant-time.js';
import type { LoginDto } from './dto/login.dto.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenService } from './token.service.js';

/** De onde veio a chamada. Alimenta o rate limit e o registro da sessao. */
export interface RequestContext {
  ip: string;
  userAgent: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: RefreshTokenService,
    private readonly rateLimit: LoginRateLimitService,
  ) {}

  /**
   * Login por e-mail e senha.
   *
   * Todo caminho de recusa — e-mail inexistente, senha errada, usuario
   * desativado — devolve exatamente o mesmo 401 e demora o mesmo tanto. Quem
   * tenta descobrir se um e-mail tem conta no painel nao consegue distinguir
   * os tres nem pelo corpo, nem pelo relogio.
   */
  login(dto: LoginDto, context: RequestContext): Promise<AuthSession> {
    return withMinimumDuration(LOGIN_MIN_DURATION_MS, async () => {
      const email = dto.email.trim().toLowerCase();

      await this.rateLimit.assertWithinLimit(context.ip, email);

      // `+passwordHash`: o campo e `select: false` no schema e so o login o pede.
      const user = await this.users.findOne({ email }).select('+passwordHash').exec();
      const passwordMatches = await this.passwords.verify(user?.passwordHash, dto.password);

      if (!user || !passwordMatches || !user.isActive) {
        await this.rateLimit.registerFailure(context.ip, email);

        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }

      await this.rateLimit.clear(context.ip, email);

      const lastLoginAt = new Date();

      // `updateOne` em vez de `user.save()`: o documento esta carregado com o
      // hash da senha e nao ha por que reescrever esse campo para anotar uma data.
      await this.users.updateOne({ _id: user._id }, { $set: { lastLoginAt } }).exec();
      user.lastLoginAt = lastLoginAt;

      this.logger.log(`Login de ${user.email} (${user.role})`);

      return this.issueSession(user, context.userAgent);
    });
  }

  /**
   * Troca um refresh token por um par novo.
   *
   * A rotacao acontece em `RefreshTokenService.claim`, que revoga o token
   * apresentado e detecta reuso. Aqui fica o que depende do usuario: quem foi
   * desativado entre uma renovacao e outra perde todas as sessoes em vez de
   * ganhar um token novo.
   */
  async refresh(rawToken: string, context: RequestContext): Promise<AuthSession> {
    const claimed = await this.sessions.claim(rawToken);
    const user = await this.users.findById(claimed.userId).exec();

    if (!user || !user.isActive) {
      await this.sessions.revokeAllSessions(claimed.userId);

      throw new UnauthorizedException('Sessao invalida.');
    }

    return this.issueSession(user, context.userAgent, claimed.tokenId);
  }

  /**
   * Encerra a sessao apresentada. Idempotente de proposito: token ausente,
   * expirado ou ja revogado tambem resulta em logout feito — o cliente nao
   * tem o que fazer com um erro aqui.
   */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    try {
      await this.sessions.revoke(rawToken);
    } catch {
      // Token invalido no logout nao e incidente: os cookies sao apagados
      // do mesmo jeito pelo controller.
    }
  }

  /** Derruba o usuario em todos os dispositivos. */
  async logoutAll(userId: string): Promise<void> {
    const revoked = await this.sessions.revokeAllSessions(new Types.ObjectId(userId));

    this.logger.log(`Logout global do usuario ${userId}: ${revoked} sessoes revogadas`);
  }

  private async issueSession(
    user: UserDocument,
    userAgent: string,
    replaces?: Types.ObjectId,
  ): Promise<AuthSession> {
    const [accessToken, refresh] = await Promise.all([
      this.tokens.signAccessToken(user),
      this.sessions.issue(user._id, userAgent, replaces),
    ]);

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      tokenType: 'Bearer',
      user: toAuthenticatedUser(user),
    };
  }
}
