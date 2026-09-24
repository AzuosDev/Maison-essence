import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { Customer } from '../customers/schemas/customer.schema.js';
import { User } from '../users/schemas/user.schema.js';
import {
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import type { TokenAudience } from './auth.types.js';
import { TOKEN_AUDIENCES } from './auth.types.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';
import { TokenService } from './token.service.js';

/** Refresh token recem-emitido: o valor em texto so existe aqui e na resposta. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Quem e o dono da sessao.
 *
 * Os dois campos andam sempre juntos: o `id` sozinho e ambiguo, porque o
 * mesmo ObjectId poderia existir nas duas colecoes, e e a audiencia que diz
 * em qual delas procurar e qual segredo assina o token.
 */
export interface SessionOwner {
  id: Types.ObjectId;
  audience: TokenAudience;
}

/** Sessao consumida pela rotacao: o documento ja foi revogado quando isso volta. */
export interface ClaimedSession {
  tokenId: Types.ObjectId;
  ownerId: Types.ObjectId;
}

const MAX_USER_AGENT_LENGTH = 255;

/**
 * Ciclo de vida das sessoes, do painel e da loja.
 *
 * A colecao guarda o SHA-256 do token, nunca o token. SHA-256 e nao argon2
 * porque o que esta sendo protegido nao e uma senha: o token e um JWT
 * aleatorio de entropia alta, imune a dicionario, e um KDF lento so
 * acrescentaria dezenas de milissegundos a cada renovacao.
 *
 * As duas audiencias passam por aqui, e toda consulta filtra pela audiencia
 * do chamador. Um refresh token de cliente nem chega a ser comparado com uma
 * sessao de painel: antes disso ele ja falhou na assinatura, porque o segredo
 * e outro.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshToken>,
    // O contador de credencial vive no dono da sessao, mas quem o incrementa e
    // a revogacao em massa daqui: derrubar as sessoes sem matar os access
    // tokens ja emitidos deixaria o intruso com ate 15 minutos de acesso.
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Emite um refresh token novo. `replaces` liga o token anterior a este na
   * arvore de rotacao (`replacedBy`).
   */
  async issue(
    owner: SessionOwner,
    userAgent: string,
    replaces?: Types.ObjectId,
  ): Promise<IssuedRefreshToken> {
    // O `_id` nasce antes do token porque ele e o `jti` assinado dentro dele.
    const tokenId = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + ttlOf(owner.audience) * 1000);
    const token = await this.tokenService.signRefreshToken(
      owner.id.toHexString(),
      tokenId.toHexString(),
      owner.audience,
    );

    await this.tokens.create({
      _id: tokenId,
      userId: owner.id,
      audience: owner.audience,
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
   * Reuso de token ja revogado derruba todas as sessoes do dono: se o token
   * vazou, nao da para saber qual das duas partes e a legitima, entao as duas
   * perdem a sessao e quem e dono refaz o login.
   */
  async claim(rawToken: string, audience: TokenAudience): Promise<ClaimedSession> {
    const payload = await this.tokenService.verifyRefreshToken(rawToken, audience);
    const tokenId = toObjectId(payload.jti);
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    if (!tokenId) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const claimed = await this.tokens
      .findOneAndUpdate(
        { _id: tokenId, audience, tokenHash, revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now } },
      )
      .exec();

    if (claimed) {
      return { tokenId, ownerId: claimed.userId };
    }

    const known = await this.tokens.findOne({ _id: tokenId, audience, tokenHash }).exec();

    if (known?.revokedAt) {
      this.logger.warn(
        `Reuso de refresh token detectado (${audience}, dono ${known.userId.toHexString()}): ` +
          'todas as sessões foram revogadas',
      );
      await this.revokeAllSessions({ id: known.userId, audience });
    }

    // Token expirado, desconhecido ou reusado: a resposta e a mesma.
    throw new UnauthorizedException('Sessão inválida.');
  }

  /** Revoga a sessao apresentada. Usado no logout; nunca dispara deteccao de reuso. */
  async revoke(rawToken: string, audience: TokenAudience): Promise<void> {
    const payload = await this.tokenService.verifyRefreshToken(rawToken, audience);
    const tokenId = toObjectId(payload.jti);

    if (!tokenId) {
      return;
    }

    await this.tokens
      .updateOne(
        { _id: tokenId, audience, tokenHash: hashToken(rawToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  /**
   * Derruba o dono em todos os dispositivos: revoga os refresh tokens abertos
   * e incrementa `credentialVersion`, o que invalida na hora os access tokens
   * ja emitidos.
   */
  async revokeAllSessions(owner: SessionOwner): Promise<number> {
    const revoked = await this.revokeRefreshTokens(owner);

    await this.bumpCredentialVersion(owner);

    return revoked;
  }

  /**
   * Revoga so os refresh tokens, sem tocar na versao da credencial.
   *
   * Existe para quem ja vai incrementar a versao na mesma escrita que faz
   * outra coisa — a troca de senha grava hash, flag e versao de uma vez so.
   */
  async revokeRefreshTokens(owner: SessionOwner): Promise<number> {
    const result = await this.tokens
      .updateMany(
        { userId: owner.id, audience: owner.audience, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
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
  async bumpCredentialVersion(owner: SessionOwner): Promise<void> {
    const bump = { $inc: { credentialVersion: 1 } };

    // Dois `updateOne` em vez de um sobre a colecao escolhida: sao models de
    // tipos diferentes, e uniao de models nao se chama.
    if (owner.audience === TOKEN_AUDIENCES.CUSTOMER) {
      await this.customers.updateOne({ _id: owner.id }, bump).exec();

      return;
    }

    await this.users.updateOne({ _id: owner.id }, bump).exec();
  }
}

/** A sessao e de um usuario do painel. */
export function adminOwner(id: Types.ObjectId): SessionOwner {
  return { id, audience: TOKEN_AUDIENCES.ADMIN };
}

/** A sessao e de um cliente da loja. */
export function customerOwner(id: Types.ObjectId): SessionOwner {
  return { id, audience: TOKEN_AUDIENCES.CUSTOMER };
}

/** SHA-256 em hex: 64 caracteres, deterministico, indexavel. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function ttlOf(audience: TokenAudience): number {
  return audience === TOKEN_AUDIENCES.CUSTOMER
    ? CUSTOMER_REFRESH_TOKEN_TTL_SECONDS
    : REFRESH_TOKEN_TTL_SECONDS;
}

function toObjectId(value: string): Types.ObjectId | undefined {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
}
