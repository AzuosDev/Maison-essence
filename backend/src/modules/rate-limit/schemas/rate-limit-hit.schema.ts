import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, integerProp, textProp } from '../../../database/schema-helpers.js';

/**
 * Contador de chamadas de uma rota publica, por janela de tempo.
 *
 * Mora no banco pelo mesmo motivo que o contador de login: cada invocacao
 * serverless e um processo novo, e a Vercel sobe varias em paralelo — um
 * contador em memoria zera no cold start e nao ve o que as outras instancias
 * contaram, ou seja, nao limita nada.
 *
 * `key` e o SHA-256 de `escopo|identidade`. A identidade costuma ser o IP, e
 * guardar o hash em vez do endereco evita que a colecao de rate limit vire um
 * registro de quem visitou a loja.
 *
 * E a unica escrita que uma rota de calculo puro faz, e nao e dado do
 * cliente: e infraestrutura da propria defesa, sem a qual o limite nao
 * existe.
 */
@Schema(baseSchemaOptions({ collection: 'rate_limit_hits' }))
export class RateLimitHit extends BaseSchema {
  @Prop(textProp({ required: true, max: 64, unique: true }))
  key: string;

  /** Chamadas ja contadas na janela aberta. */
  @Prop(integerProp({ min: 0, default: 0 }))
  count: number;

  /** Fim da janela. Ate la o contador acumula; depois ele nao vale mais. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type RateLimitHitDocument = HydratedDocument<RateLimitHit>;

export const RateLimitHitSchema = createSchema(RateLimitHit);

// O Mongo varre o TTL a cada 60 segundos, entao o documento vencido pode
// sobreviver um minuto. Toda consulta filtra por `expiresAt` tambem, e por
// isso o atraso da varredura nao prende ninguem alem da janela.
RateLimitHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
