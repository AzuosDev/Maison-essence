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

/** Refresh token recém-emitido: o valor em texto só existe aqui e na resposta. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Quem e o dono da sessão.
 *
 * Os dois campos andam sempre juntos: o `id` sozinho e ambiguo, porque o
 * mesmo ObjectId poderia existir nas duas coleções, e e a audiência que diz
 * em qual delas procurar e qual segredo assina o token.
 */
export interface SessionOwner {
  id: Types.ObjectId;
  audience: TokenAudience;
}

/** Sessão consumida pela rotação: o documento já foi revogado quando isso volta. */
export interface ClaimedSession {
  tokenId: Types.ObjectId;
  ownerId: Types.ObjectId;
}

const MAX_USER_AGENT_LENGTH = 255;

/**
 * Ciclo de vida das sessões, do painel e da loja.
 *
 * A coleção guarda o SHA-256 do token, nunca o token. SHA-256 e não argon2
 * porque o que esta sendo protegido não e uma senha: o token e um JWT
 * aleatório de entropia alta, imune a dicionário, e um KDF lento só
 * acrescentaria dezenas de milissegundos a cada renovação.
 *
 * As duas audiências passam por aqui, e toda consulta filtra pela audiência
 * do chamador. Um refresh token de cliente nem chega a ser comparado com uma
 * sessão de painel: antes disso ele já falhou na assinatura, porque o segredo
 * e outro.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshToken>,
    // O contador de credencial vive no dono da sessão, mas quem o incrementa e
    // a revogação em massa daqui: derrubar as sessões sem matar os access
    // tokens já emitidos deixaria o intruso com até 15 minutos de acesso.
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Emite um refresh token novo. `replaces` liga o token anterior a este na
   * árvore de rotação (`replacedBy`).
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
   * operação atômica que o encontra.
   *
   * Atômica de propósito. Dois requests simultaneos com o mesmo token — o
   * caso comum de duas abas renovando junto — não podem ambos receber uma
   * sessão nova; o segundo cai no caminho de reuso.
   *
   * Reuso de token já revogado derruba todas as sessões do dono: se o token
   * vazou, não da para saber qual das duas partes e a legitima, então as duas
   * perdem a sessão e quem e dono refaz o login.
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

  /** Revoga a sessão apresentada. Usado no logout; nunca dispara detecção de reuso. */
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
   * e incrementa `credentialVersion`, o que inválida na hora os access tokens
   * já emitidos.
   */
  async revokeAllSessions(owner: SessionOwner): Promise<number> {
    const revoked = await this.revokeRefreshTokens(owner);

    await this.bumpCredentialVersion(owner);

    return revoked;
  }

  /**
   * Revoga só os refresh tokens, sem tocar na versão da credencial.
   *
   * Existe para quem já vai incrementar a versão na mesma escrita que faz
   * outra coisa — a troca de senha grava hash, flag e versão de uma vez só.
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
   * Inválida os access tokens em circulação sem encerrar as sessões.
   *
   * E o que uma mudanca de papel precisa: o token atual para de valer na hora
   * (o papel dentro dele ficou velho), o refresh continua válido e a próxima
   * renovação já sai com o papel novo, sem novo login.
   */
  async bumpCredentialVersion(owner: SessionOwner): Promise<void> {
    const bump = { $inc: { credentialVersion: 1 } };

    // Dois `updateOne` em vez de um sobre a coleção escolhida: são models de
    // tipos diferentes, e união de models não se chama.
    if (owner.audience === TOKEN_AUDIENCES.CUSTOMER) {
      await this.customers.updateOne({ _id: owner.id }, bump).exec();

      return;
    }

    await this.users.updateOne({ _id: owner.id }, bump).exec();
  }
}

/** A sessão e de um usuário do painel. */
export function adminOwner(id: Types.ObjectId): SessionOwner {
  return { id, audience: TOKEN_AUDIENCES.ADMIN };
}

/** A sessão e de um cliente da loja. */
export function customerOwner(id: Types.ObjectId): SessionOwner {
  return { id, audience: TOKEN_AUDIENCES.CUSTOMER };
}

/** SHA-256 em hex: 64 caracteres, deterministico, indexável. */
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
