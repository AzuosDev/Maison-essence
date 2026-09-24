import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, integerProp, textProp } from '../../../database/schema-helpers.js';

/**
 * Contador de tentativas de login falhas, por IP + e-mail.
 *
 * Mora no banco, e não em memória, porque cada invocação serverless e um
 * processo novo: um contador em memória zera sozinho a cada cold start e não e
 * compartilhado entre as instâncias que a Vercel sobe em paralelo — ou seja,
 * não limita nada.
 *
 * `key` e o SHA-256 de `ip|email`. Guardar o hash, e não o par em texto, evita
 * transformar a coleção de rate limit em uma lista de e-mails que tentaram
 * entrar.
 */
@Schema(baseSchemaOptions({ collection: 'login_attempts' }))
export class LoginAttempt extends BaseSchema {
  @Prop(textProp({ required: true, max: 64, unique: true }))
  key: string;

  @Prop(integerProp({ min: 0, default: 0 }))
  attempts: number;

  /** Fim da janela. Até lá o contador acumula; depois ele não vale mais. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type LoginAttemptDocument = HydratedDocument<LoginAttempt>;

export const LoginAttemptSchema = createSchema(LoginAttempt);

// O Mongo limpa o contador vencido sozinho. A varredura do TTL roda a cada 60
// segundos, então toda consulta filtra por `expiresAt` também: o documento
// vencido pode continuar lá por um minuto.
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
