import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { STATES } from 'mongoose';

/** Quantos documentos há em uma coleção. */
export interface CollectionCount {
  name: string;
  count: number;
}

export const DATABASE_UNAVAILABLE_MESSAGE =
  'Banco indisponível: a contagem por coleção não pode ser lida agora.';

/**
 * O que a área de sistema do painel lê sobre a instalação.
 *
 * Diagnóstico, não domínio: nada aqui escreve, e por isso não há schema
 * próprio nem trilha de auditoria — ler quantos documentos existem não e um
 * ato que alguém precise justificar depois.
 */
@Injectable()
export class SystemService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Um número por coleção registrada, em ordem alfabética.
   *
   * A lista sai dos models que os módulos registraram na conexão, e não de um
   * `listCollections` no banco: o que interessa ao painel e o que esta
   * aplicação conhece. A diferença aparece em coleção que ainda não recebeu
   * documento — ela não existe no Mongo, mas aparece aqui com zero, que e a
   * resposta certa para "quantos pedidos há" numa loja recém-instalada.
   *
   * `estimatedDocumentCount` lê os metadados da coleção em vez de varrer os
   * documentos: e uma ida ao banco de custo constante, e a imprecisão que ele
   * admite — uma escrita em voo — não muda nada numa tela de diagnóstico.
   */
  async collectionCounts(): Promise<CollectionCount[]> {
    // Com `bufferCommands` desligado, contar sem conexão estoura um erro de
    // driver que viraria 500. O 503 diz a mesma coisa que o health check ao
    // lado já esta dizendo na mesma tela: o banco e que não está lá.
    if (this.connection.readyState !== STATES.connected) {
      throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE);
    }

    const counts = await Promise.all(
      [...this.registeredCollections()].map(async ([name, count]) => ({
        name,
        count: await count(),
      })),
    );

    return counts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  /**
   * As coleções registradas, uma vez cada.
   *
   * Dois models podem apontar para a mesma coleção — um discriminator, um
   * model auxiliar sobre a mesma tabela —, e a contagem e da coleção, não do
   * model: o primeiro que a nomeia basta para conta-lá.
   */
  private registeredCollections(): Map<string, () => Promise<number>> {
    const collections = new Map<string, () => Promise<number>>();

    for (const model of Object.values(this.connection.models)) {
      const { collectionName } = model.collection;

      if (!collections.has(collectionName)) {
        collections.set(collectionName, () => model.estimatedDocumentCount());
      }
    }

    return collections;
  }
}
