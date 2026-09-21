import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, objectIdProp, textProp } from '../../../database/schema-helpers.js';
import { User } from '../../users/schemas/user.schema.js';

/**
 * Refresh token emitido para um usuario do painel.
 *
 * Guarda o hash, nunca o token: vazamento do banco nao pode virar sessao. E
 * guarda a arvore de substituicoes (`replacedBy`) porque a deteccao de reuso
 * depende de saber que um token revogado foi apresentado de novo.
 */
@Schema(baseSchemaOptions({ collection: 'refresh_tokens' }))
export class RefreshToken extends BaseSchema {
  @Prop(objectIdProp({ ref: User.name, required: true }))
  userId: Types.ObjectId;

  @Prop(textProp({ required: true, max: 255, select: false }))
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  /** Token que substituiu este na rotacao. Literal em vez de `RefreshToken.name`
   * porque a classe ainda nao existe quando o decorator avalia. */
  @Prop(objectIdProp({ ref: 'RefreshToken', default: null }))
  replacedBy: Types.ObjectId | null;

  @Prop(textProp({ max: 255, default: '' }))
  userAgent: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenSchema = createSchema(RefreshToken);

RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
// Revogar todas as sessoes de um usuario de uma vez.
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });
// O proprio Mongo apaga o registro quando o token expira: depois disso ele nao
// serve nem para autenticar nem para detectar reuso.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
