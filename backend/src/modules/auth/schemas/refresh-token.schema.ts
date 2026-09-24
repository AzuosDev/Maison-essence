import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  createSchema,
  enumProp,
  objectIdProp,
  textProp,
} from '../../../database/schema-helpers.js';
import { TOKEN_AUDIENCES } from '../auth.types.js';
import type { TokenAudience } from '../auth.types.js';

const AUDIENCE_VALUES: readonly TokenAudience[] = Object.values(TOKEN_AUDIENCES);

/**
 * Refresh token emitido para um usuário do painel ou para um cliente da loja.
 *
 * Guarda o hash, nunca o token: vazamento do banco não pode virar sessão. E
 * guarda a árvore de substituições (`replacedBy`) porque a detecção de reuso
 * depende de saber que um token revogado foi apresentado de novo.
 *
 * Uma coleção para as duas audiências porque a mecânica e idêntica — hash,
 * rotação, detecção de reuso, expiração pelo TTL — e o que separa as sessões e
 * o campo `audience`, conferido em toda consulta. Duas coleções significariam
 * duas implementações da parte mais delicada do módulo.
 */
@Schema(baseSchemaOptions({ collection: 'refresh_tokens' }))
export class RefreshToken extends BaseSchema {
  /**
   * Dono da sessão: o `_id` do usuário do painel ou o do cliente, conforme
   * `audience`. Sem `ref`, porque a coleção de destino depende do campo ao
   * lado e `populate` não teria como escolher.
   */
  @Prop(objectIdProp({ required: true }))
  userId: Types.ObjectId;

  /** Para qual lado esta sessão vale. Nunca atravessa. */
  @Prop(enumProp(AUDIENCE_VALUES, { required: true, default: TOKEN_AUDIENCES.ADMIN }))
  audience: TokenAudience;

  @Prop(textProp({ required: true, max: 255, select: false }))
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  /** Token que substituiu este na rotação. Literal em vez de `RefreshToken.name`
   * porque a classe ainda não existe quando o decorator avalia. */
  @Prop(objectIdProp({ ref: 'RefreshToken', default: null }))
  replacedBy: Types.ObjectId | null;

  @Prop(textProp({ max: 255, default: '' }))
  userAgent: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenSchema = createSchema(RefreshToken);

RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
// Revogar todas as sessões de um dono de uma vez, dentro da sua audiência.
RefreshTokenSchema.index({ userId: 1, audience: 1, revokedAt: 1 });
// O próprio Mongo apaga o registro quando o token expira: depois disso ele não
// serve nem para autenticar nem para detectar reuso.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
