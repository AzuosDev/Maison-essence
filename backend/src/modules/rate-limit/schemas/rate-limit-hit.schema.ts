import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, integerProp, textProp } from '../../../database/schema-helpers.js';

/**
 * Contador de chamadas de uma rota publica, por janela de tempo.
 *
 * Mora no banco pelo mesmo motivo que o contador de login: cada invocação
 * serverless e um processo novo, e a Vercel sobe várias em paralelo — um
 * contador em memória zera no cold start e não vê o que as outras instâncias
 * contaram, ou seja, não limita nada.
 *
 * `key` e o SHA-256 de `escopo|identidade`. A identidade costuma ser o IP, e
 * guardar o hash em vez do endereço evita que a coleção de rate limit vire um
 * registro de quem visitou a loja.
 *
 * E a única escrita que uma rota de cálculo puro faz, e não e dado do
 * cliente: e infraestrutura da própria defesa, sem a qual o limite não
 * existe.
 */
@Schema(baseSchemaOptions({ collection: 'rate_limit_hits' }))
export class RateLimitHit extends BaseSchema {
  @Prop(textProp({ required: true, max: 64, unique: true }))
  key: string;

  /** Chamadas já contadas na janela aberta. */
  @Prop(integerProp({ min: 0, default: 0 }))
  count: number;

  /** Fim da janela. Até lá o contador acumula; depois ele não vale mais. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type RateLimitHitDocument = HydratedDocument<RateLimitHit>;

export const RateLimitHitSchema = createSchema(RateLimitHit);

// O Mongo varre o TTL a cada 60 segundos, então o documento vencido pode
// sobreviver um minuto. Toda consulta filtra por `expiresAt` também, e por
// isso o atraso da varredura não prende ninguém além da janela.
RateLimitHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
