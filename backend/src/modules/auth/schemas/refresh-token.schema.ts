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
 * Refresh token emitido para um usuario do painel ou para um cliente da loja.
 *
 * Guarda o hash, nunca o token: vazamento do banco nao pode virar sessao. E
 * guarda a arvore de substituicoes (`replacedBy`) porque a deteccao de reuso
 * depende de saber que um token revogado foi apresentado de novo.
 *
 * Uma colecao para as duas audiencias porque a mecanica e identica — hash,
 * rotacao, deteccao de reuso, expiracao pelo TTL — e o que separa as sessoes e
 * o campo `audience`, conferido em toda consulta. Duas colecoes significariam
 * duas implementacoes da parte mais delicada do modulo.
 */
@Schema(baseSchemaOptions({ collection: 'refresh_tokens' }))
export class RefreshToken extends BaseSchema {
  /**
   * Dono da sessao: o `_id` do usuario do painel ou o do cliente, conforme
   * `audience`. Sem `ref`, porque a colecao de destino depende do campo ao
   * lado e `populate` nao teria como escolher.
   */
  @Prop(objectIdProp({ required: true }))
  userId: Types.ObjectId;

  /** Para qual lado esta sessao vale. Nunca atravessa. */
  @Prop(enumProp(AUDIENCE_VALUES, { required: true, default: TOKEN_AUDIENCES.ADMIN }))
  audience: TokenAudience;

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
// Revogar todas as sessoes de um dono de uma vez, dentro da sua audiencia.
RefreshTokenSchema.index({ userId: 1, audience: 1, revokedAt: 1 });
// O proprio Mongo apaga o registro quando o token expira: depois disso ele nao
// serve nem para autenticar nem para detectar reuso.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
