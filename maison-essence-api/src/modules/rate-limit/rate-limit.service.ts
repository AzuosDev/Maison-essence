import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import { TOO_MANY_REQUESTS_MESSAGE } from './rate-limit.constants.js';
import type { RateLimitRule } from './rate-limit.decorator.js';
import { RateLimitHit } from './schemas/rate-limit-hit.schema.js';

const DUPLICATE_KEY = 11000;

/** A regra somada a quem esta chamando — o IP, na maioria das rotas. */
export interface RateLimitInput extends RateLimitRule {
  identity: string;
}

/**
 * Limite de chamadas por janela, compartilhado entre as rotas publicas.
 *
 * Janela fixa, e nao deslizante: a primeira chamada abre a janela e ela vale
 * pelo tempo declarado. Uma janela fixa deixa passar ate o dobro do limite na
 * virada — trinta no fim de um minuto e trinta no comeco do seguinte —, e
 * isso e aceitavel aqui: o que se quer evitar e o robo que varre a cotacao em
 * laco, nao o cliente apressado que recalcula o carrinho algumas vezes.
 * Janela deslizante exigiria guardar o instante de cada chamada, e passar a
 * escrever um documento por requisicao numa rota de calculo puro seria trocar
 * o problema por outro.
 */
@Injectable()
export class RateLimitService {
  constructor(@InjectModel(RateLimitHit.name) private readonly hits: Model<RateLimitHit>) {}

  /** Conta mais uma chamada e lanca 429 quando ela passa do teto. */
  async consume(input: RateLimitInput): Promise<void> {
    const key = buildKey(input.scope, input.identity);
    const now = new Date();
    // Incremento e leitura na mesma operacao: duas invocacoes simultaneas da
    // mesma funcao serverless nao podem ler o mesmo contador e grava-lo duas
    // vezes com o mesmo valor.
    const open = await this.hits
      .findOneAndUpdate(
        { key, expiresAt: { $gt: now } },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (open === null) {
      await this.openWindow(key, now, input.windowSeconds);

      return;
    }

    if (open.count > input.limit) {
      throw new HttpException(TOO_MANY_REQUESTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Abre a janela desta chave, reaproveitando o documento vencido.
   *
   * O `upsert` cobre tanto a primeira chamada quanto o contador que o TTL
   * ainda nao varreu — nos dois casos a janela nasce em 1, e nao somada a de
   * antes. Duas invocacoes que chegam juntas a colecao vazia podem gravar 1 as
   * duas e perder uma unidade da contagem; e o unico desvio possivel e custa
   * uma chamada a mais em trinta, o que nao muda o que o limite protege.
   */
  private async openWindow(key: string, now: Date, windowSeconds: number): Promise<void> {
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

    try {
      await this.hits
        .updateOne({ key }, { $set: { count: 1, expiresAt } }, { upsert: true })
        .exec();
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      // A outra invocacao venceu a corrida do `upsert`: a janela dela ja vale,
      // e esta chamada so precisa ser contada dentro dela.
      await this.hits.updateOne({ key }, { $inc: { count: 1 } }).exec();
    }
  }
}

function buildKey(scope: string, identity: string): string {
  return createHash('sha256').update(`${scope}|${identity}`).digest('hex');
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
