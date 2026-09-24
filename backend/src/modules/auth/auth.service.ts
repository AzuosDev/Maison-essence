import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  UNKNOWN_ACTOR_ID,
} from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_MIN_DURATION_MS,
} from './auth.constants.js';
import type { AuthSession, AuthenticatedUser } from './auth.types.js';
import { TOKEN_AUDIENCES } from './auth.types.js';
import { toAuthenticatedUser } from './auth.types.js';
import { withMinimumDuration } from './constant-time.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService, adminOwner } from './refresh-token.service.js';
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
    private readonly audit: AuditService,
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
        // A trilha guarda o motivo, que a resposta nunca conta: e a
        // diferenca entre "alguem esta chutando e-mails" e "alguem esta
        // tentando a conta da dona". Escrever aqui nao abre caminho para
        // encher a colecao: o limite da rota recusa a sexta tentativa
        // antes de chegar neste metodo.
        await this.audit.record({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          actor: { id: UNKNOWN_ACTOR_ID, email },
          details: { reason: failureReason(user, passwordMatches) },
        });

        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }

      await this.rateLimit.clear(context.ip, email);

      const lastLoginAt = new Date();

      // `updateOne` em vez de `user.save()`: o documento esta carregado com o
      // hash da senha e nao ha por que reescrever esse campo para anotar uma data.
      await this.users.updateOne({ _id: user._id }, { $set: { lastLoginAt } }).exec();
      user.lastLoginAt = lastLoginAt;

      this.logger.log(`Login de ${user.email} (${user.role})`);

      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
        // Sem alvo: no login, quem age e sobre quem se age sao o mesmo.
        actor: { id: user._id.toHexString(), email: user.email, role: user.role },
      });

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
    const claimed = await this.sessions.claim(rawToken, TOKEN_AUDIENCES.ADMIN);
    const user = await this.users.findById(claimed.ownerId).exec();

    if (!user || !user.isActive) {
      await this.sessions.revokeAllSessions(adminOwner(claimed.ownerId));

      throw new UnauthorizedException('Sessão inválida.');
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
      await this.sessions.revoke(rawToken, TOKEN_AUDIENCES.ADMIN);
    } catch {
      // Token invalido no logout nao e incidente: os cookies sao apagados
      // do mesmo jeito pelo controller.
    }
  }

  /**
   * Troca a senha do proprio usuario.
   *
   * Derruba as outras sessoes — trocar senha e o que se faz quando se
   * desconfia de acesso indevido, e manter as demais abertas esvaziaria o
   * gesto — e ja devolve uma sessao nova para quem trocou. Sem isso, o
   * usuario com senha temporaria teria de fazer login de novo logo depois de
   * ter sido obrigado a trocar a senha.
   *
   * O hash, a flag e a versao da credencial vao em uma unica escrita: nao
   * existe instante em que a senha nova ja vale e o token velho ainda passa.
   */
  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<AuthSession> {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }

    const userId = new Types.ObjectId(actor.id);
    const stored = await this.users.findById(userId).select('+passwordHash').exec();

    if (!stored) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const matches = await this.passwords.verify(stored.passwordHash, dto.currentPassword);

    if (!matches) {
      // 401 e nao 403: a credencial apresentada e que esta errada.
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const updated = await this.users
      .findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            passwordHash: await this.passwords.hash(dto.newPassword),
            mustChangePassword: false,
          },
          $inc: { credentialVersion: 1 },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    await this.sessions.revokeRefreshTokens(adminOwner(userId));

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      actor: { id: actor.id, email: actor.email, role: actor.role },
      target: { kind: AUDIT_TARGETS.USER, id: actor.id, label: updated.email },
    });

    return this.issueSession(updated, context.userAgent);
  }

  /** Derruba o usuario em todos os dispositivos. */
  async logoutAll(userId: string): Promise<void> {
    const owner = adminOwner(new Types.ObjectId(userId));
    const revoked = await this.sessions.revokeAllSessions(owner);

    this.logger.log(`Logout global do usuário ${userId}: ${revoked} sessões revogadas`);
  }

  private async issueSession(
    user: UserDocument,
    userAgent: string,
    replaces?: Types.ObjectId,
  ): Promise<AuthSession> {
    const [accessToken, refresh] = await Promise.all([
      this.tokens.signAccessToken(user),
      this.sessions.issue(adminOwner(user._id), userAgent, replaces),
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

/**
 * Por que o login foi recusado — para a trilha, nunca para a resposta.
 *
 * Quem tenta entrar recebe sempre a mesma frase e sempre no mesmo tempo (ver
 * `login`). Quem investiga precisa da diferenca: e-mail que nao existe conta
 * uma historia, senha errada no e-mail da dona conta outra, e conta
 * desativada tentando entrar conta a terceira.
 */
function failureReason(user: UserDocument | null, passwordMatches: boolean): string {
  if (!user) {
    return 'email_desconhecido';
  }

  if (!passwordMatches) {
    return 'senha_incorreta';
  }

  return 'conta_desativada';
}
