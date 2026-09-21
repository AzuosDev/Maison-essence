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
 * Le primeiro e so escreve quando nao ha nada, em vez de resolver tudo em um
 * `findOneAndUpdate({}, {}, { upsert: true })`. O upsert numa ida so parecia mais
 * barato, mas o Mongoose carimba `updatedAt` em toda atualizacao, inclusive na
 * que nao muda campo nenhum: o documento passava a ter idade de ultima *leitura*
 * e nao de ultima *alteracao*. E essa data que versiona o ETag da rota publica de
 * configuracoes — cada visita a loja mudava a etiqueta, a CDN nunca recebia um
 * 304, e toda leitura da vitrine virava uma escrita no banco.
 *
 * O `catch` cobre a corrida: quando duas invocacoes encontram a colecao vazia ao
 * mesmo tempo, o indice unico derruba uma delas com E11000, e ai basta reler o
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
