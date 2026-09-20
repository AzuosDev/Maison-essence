import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { User } from '../users/schemas/user.schema.js';
import { REFRESH_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';
import { TokenService } from './token.service.js';

/** Refresh token recem-emitido: o valor em texto so existe aqui e na resposta. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** Sessao consumida pela rotacao: o documento ja foi revogado quando isso volta. */
export interface ClaimedSession {
  tokenId: Types.ObjectId;
  userId: Types.ObjectId;
}

const MAX_USER_AGENT_LENGTH = 255;

/**
 * Ciclo de vida das sessoes do painel.
 *
 * A colecao guarda o SHA-256 do token, nunca o token. SHA-256 e nao argon2
 * porque o que esta sendo protegido nao e uma senha: o token e um JWT
 * aleatorio de entropia alta, imune a dicionario, e um KDF lento so
 * acrescentaria dezenas de milissegundos a cada renovacao.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshToken>,
    // O contador de credencial vive em `User`, mas quem o incrementa e a
    // revogacao em massa daqui: derrubar as sessoes sem matar os access
    // tokens ja emitidos deixaria o intruso com ate 15 minutos de acesso.
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Emite um refresh token novo. `replaces` liga o token anterior a este na
   * arvore de rotacao (`replacedBy`).
   */
  async issue(
    userId: Types.ObjectId,
    userAgent: string,
    replaces?: Types.ObjectId,
  ): Promise<IssuedRefreshToken> {
    // O `_id` nasce antes do token porque ele e o `jti` assinado dentro dele.
    const tokenId = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const token = await this.tokenService.signRefreshToken(
      userId.toHexString(),
      tokenId.toHexString(),
    );

    await this.tokens.create({
      _id: tokenId,
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH),
    });

    if (replaces) {
      await this.tokens.updateOne({ _id: replaces }, { $set: { replacedBy: tokenId } });
    }

    return { token, expiresAt };
  }

  /**
   * Consome um refresh token: confere a assinatura e o revoga na mesma
   * operacao atomica que o encontra.
   *
   * Atomica de proposito. Dois requests simultaneos com o mesmo token — o
   * caso comum de duas abas renovando junto — nao podem ambos receber uma
   * sessao nova; o segundo cai no caminho de reuso.
   *
   * Reuso de token ja revogado derruba todas as sessoes do usuario: se o
   * token vazou, nao da para saber qual das duas partes e a legitima, entao
   * as duas perdem a sessao e a dona do painel refaz o login.
   */
  async claim(rawToken: string): Promise<ClaimedSession> {
    const payload = await this.tokenService.verifyRefreshToken(rawToken);
    const tokenId = toObjectId(payload.jti);
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    if (!tokenId) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const claimed = await this.tokens
      .findOneAndUpdate(
        { _id: tokenId, tokenHash, revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now } },
      )
      .exec();

    if (claimed) {
      return { tokenId, userId: claimed.userId };
    }

    const known = await this.tokens.findOne({ _id: tokenId, tokenHash }).exec();

    if (known?.revokedAt) {
      this.logger.warn(
        `Reuso de refresh token detectado (usuario ${known.userId.toHexString()}): todas as sessoes foram revogadas`,
      );
      await this.revokeAllSessions(known.userId);
    }

    // Token expirado, desconhecido ou reusado: a resposta e a mesma.
    throw new UnauthorizedException('Sessao invalida.');
  }

  /** Revoga a sessao apresentada. Usado no logout; nunca dispara deteccao de reuso. */
  async revoke(rawToken: string): Promise<void> {
    const payload = await this.tokenService.verifyRefreshToken(rawToken);
    const tokenId = toObjectId(payload.jti);

    if (!tokenId) {
      return;
    }

    await this.tokens
      .updateOne(
        { _id: tokenId, tokenHash: hashToken(rawToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  /**
   * Derruba o usuario em todos os dispositivos: revoga os refresh tokens
   * abertos e incrementa `credentialVersion`, o que invalida na hora os
   * access tokens ja emitidos.
   */
  async revokeAllSessions(userId: Types.ObjectId): Promise<number> {
    const revoked = await this.revokeRefreshTokens(userId);

    await this.bumpCredentialVersion(userId);

    return revoked;
  }

  /**
   * Revoga so os refresh tokens, sem tocar na versao da credencial.
   *
   * Existe para quem ja vai incrementar a versao na mesma escrita que faz
   * outra coisa — a troca de senha grava hash, flag e versao de uma vez so.
   */
  async revokeRefreshTokens(userId: Types.ObjectId): Promise<number> {
    const result = await this.tokens
      .updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();

    return result.modifiedCount;
  }

  /**
   * Invalida os access tokens em circulacao sem encerrar as sessoes.
   *
   * E o que uma mudanca de papel precisa: o token atual para de valer na hora
   * (o papel dentro dele ficou velho), o refresh continua valido e a proxima
   * renovacao ja sai com o papel novo, sem novo login.
   */
  async bumpCredentialVersion(userId: Types.ObjectId): Promise<void> {
    await this.users.updateOne({ _id: userId }, { $inc: { credentialVersion: 1 } }).exec();
  }
}

/** SHA-256 em hex: 64 caracteres, deterministico, indexavel. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toObjectId(value: string): Types.ObjectId | undefined {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
}
