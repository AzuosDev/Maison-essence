import { Prop } from '@nestjs/mongoose';
import type { HydratedDocument, Model, Schema } from 'mongoose';
import { BaseSchema } from './base.schema.js';

const DUPLICATE_KEY_CODE = 11000;

/**
 * Base dos documentos que existem uma vez so na colecao — as configuracoes da
 * loja e as de pagamento.
 *
 * O campo `singleton` nao e decorativo: e ele que carrega o indice unico que
 * impede a colecao de ganhar um segundo documento. Sem isso, duas invocacoes
 * serverless simultaneas num banco vazio criariam duas configuracoes e a loja
 * passaria a responder uma ou outra conforme a sorte da consulta.
 *
 * `immutable` porque ninguem deve mexer nele, e `select: false` porque e
 * detalhe de implementacao, nao configuracao da loja.
 */
export abstract class SingletonSchema extends BaseSchema {
  @Prop({ type: Boolean, default: true, immutable: true, select: false })
  singleton: boolean;
}

/** Instala o indice unico que garante a unicidade do documento. */
export function applySingletonIndex<T>(schema: Schema<T>): void {
  schema.index({ singleton: 1 }, { unique: true, name: 'singleton_unique' });
}

/**
 * Devolve o documento unico da colecao, criando-o com os padroes do schema na
 * primeira chamada.
 *
 * O `upsert` resolve o caso normal numa ida so ao banco. O `catch` cobre a
 * corrida: quando duas invocacoes fazem o upsert ao mesmo tempo num banco
 * vazio, o indice unico derruba uma delas com E11000, e ai basta reler o
 * documento que a outra acabou de criar.
 */
export async function getOrCreateSingleton<T>(
  model: Model<T>,
): Promise<HydratedDocument<T>> {
  try {
    return await model
      .findOneAndUpdate(
        {},
        {},
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await model.findOne({}).exec();

    if (!existing) {
      throw error;
    }

    return existing;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_CODE
  );
}
