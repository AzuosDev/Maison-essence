import { Prop } from '@nestjs/mongoose';
import type { HydratedDocument, Model, Schema } from 'mongoose';
import { BaseSchema } from './base.schema.js';

const DUPLICATE_KEY_CODE = 11000;

/**
 * Base dos documentos que existem uma vez só na coleção — as configurações da
 * loja e as de pagamento.
 *
 * O campo `singleton` não e decorativo: e ele que carrega o índice único que
 * impede a coleção de ganhar um segundo documento. Sem isso, duas invocações
 * serverless simultaneas num banco vazio criariam duas configurações e a loja
 * passaria a responder uma ou outra conforme a sorte da consulta.
 *
 * `immutable` porque ninguém deve mexer nele, e `select: false` porque e
 * detalhe de implementação, não configuração da loja.
 */
export abstract class SingletonSchema extends BaseSchema {
  @Prop({ type: Boolean, default: true, immutable: true, select: false })
  singleton: boolean;
}

/** Instala o índice único que garante a unicidade do documento. */
export function applySingletonIndex<T>(schema: Schema<T>): void {
  schema.index({ singleton: 1 }, { unique: true, name: 'singleton_unique' });
}

/**
 * Devolve o documento único da coleção, criando-o com os padrões do schema na
 * primeira chamada.
 *
 * Lê primeiro e só escreve quando não há nada, em vez de resolver tudo em um
 * `findOneAndUpdate({}, {}, { upsert: true })`. O upsert numa ida só parecia mais
 * barato, mas o Mongoose carimba `updatedAt` em toda atualização, inclusive na
 * que não muda campo nenhum: o documento passava a ter idade de última *leitura*
 * e não de última *alteração*. E essa data que versiona o ETag da rota publica de
 * configurações — cada visita a loja mudava a etiqueta, a CDN nunca recebia um
 * 304, e toda leitura da vitrine virava uma escrita no banco.
 *
 * O `catch` cobre a corrida: quando duas invocações encontram a coleção vazia ao
 * mesmo tempo, o índice único derruba uma delas com E11000, e aí basta reler o
 * documento que a outra acabou de criar.
 */
export async function getOrCreateSingleton<T>(
  model: Model<T>,
): Promise<HydratedDocument<T>> {
  const existing = await model.findOne({}).exec();

  if (existing) {
    return existing;
  }

  try {
    return await model.create({} as Partial<T>);
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const created = await model.findOne({}).exec();

    if (!created) {
      throw error;
    }

    return created;
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
