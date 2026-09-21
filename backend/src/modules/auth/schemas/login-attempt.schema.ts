import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, integerProp, textProp } from '../../../database/schema-helpers.js';

/**
 * Contador de tentativas de login falhas, por IP + e-mail.
 *
 * Mora no banco, e nao em memoria, porque cada invocacao serverless e um
 * processo novo: um contador em memoria zera sozinho a cada cold start e nao e
 * compartilhado entre as instancias que a Vercel sobe em paralelo — ou seja,
 * nao limita nada.
 *
 * `key` e o SHA-256 de `ip|email`. Guardar o hash, e nao o par em texto, evita
 * transformar a colecao de rate limit em uma lista de e-mails que tentaram
 * entrar.
 */
@Schema(baseSchemaOptions({ collection: 'login_attempts' }))
export class LoginAttempt extends BaseSchema {
  @Prop(textProp({ required: true, max: 64, unique: true }))
  key: string;

  @Prop(integerProp({ min: 0, default: 0 }))
  attempts: number;

  /** Fim da janela. Ate la o contador acumula; depois ele nao vale mais. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type LoginAttemptDocument = HydratedDocument<LoginAttempt>;

export const LoginAttemptSchema = createSchema(LoginAttempt);

// O Mongo limpa o contador vencido sozinho. A varredura do TTL roda a cada 60
// segundos, entao toda consulta filtra por `expiresAt` tambem: o documento
// vencido pode continuar la por um minuto.
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
