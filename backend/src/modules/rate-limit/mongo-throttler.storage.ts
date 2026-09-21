import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Model } from 'mongoose';
import { RateLimitHit } from './schemas/rate-limit-hit.schema.js';

const DUPLICATE_KEY = 11000;

/**
 * O que o throttler espera de volta.
 *
 * Derivado da propria interface porque o pacote nao exporta o tipo do
 * registro no indice: escreve-lo a mao aqui seria uma copia que envelhece
 * sozinha na proxima versao.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** A janela aberta de uma chave, do jeito que as duas escritas devolvem. */
interface OpenWindow {
  count: number;
  expiresAt: Date;
}

/**
 * O armazenamento do `@nestjs/throttler`, no Mongo.
 *
 * O armazenamento padrao do throttler e um `Map` em memoria, e em funcao
 * serverless isso nao limita nada: cada invocacao e um processo novo, a Vercel
 * sobe varias em paralelo e o contador zera a cada cold start. Quem quisesse
 * passar do teto so precisaria de requisicoes suficientemente espacadas para
 * cair em instancias diferentes — ou seja, de nenhum esforco.
 *
 * O Mongo ja esta na frente de qualquer request desta API, entao o contador
 * compartilhado sai sem servico novo para manter. Redis seria mais rapido por
 * chamada, e e a troca a fazer se o volume justificar: a unica coisa a
 * reescrever e esta classe.
 *
 * Janela fixa, e nao deslizante: a primeira chamada abre a janela e ela vale
 * pelo tempo declarado. Janela fixa deixa passar ate o dobro do limite na
 * virada — trinta no fim de um minuto e trinta no comeco do seguinte —, e isso
 * e aceitavel aqui, porque o que se quer evitar e o laco, nao o cliente
 * apressado. Deslizante exigiria um documento por requisicao.
 */
export class MongoThrottlerStorage implements ThrottlerStorage {
  // Construido a mao pela fabrica do `ThrottlerModule` (ver
  // `rate-limit.module.ts`), e nao por injecao: assim existe uma instancia so,
  // a mesma que o guard e o `RateLimitService` usam.
  constructor(private readonly hits: Model<RateLimitHit>) {}

  /**
   * Conta mais uma chamada da chave e diz como a janela ficou.
   *
   * `ttl` e `blockDuration` chegam em milissegundos (contrato do throttler) e
   * o registro devolvido fala em segundos. O bloqueio dura o que resta da
   * janela: um castigo mais longo que ela exigiria um segundo estado no
   * documento para pouca diferenca pratica — passar do teto ja significa
   * esperar a janela virar.
   */
  async increment(key: string, ttl: number, limit: number): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    // Incremento e leitura na mesma operacao: duas invocacoes simultaneas da
    // mesma funcao nao podem ler o mesmo contador e grava-lo duas vezes com o
    // mesmo valor.
    const open = await this.hits
      .findOneAndUpdate(
        { key, expiresAt: { $gt: new Date(now) } },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    const window = open ?? (await this.openWindow(key, now, ttl));
    // Piso de um segundo: zero em `Retry-After` convida a tentar de novo na
    // hora, que e o oposto do que a resposta quer dizer.
    const timeToExpire = Math.max(1, Math.ceil((window.expiresAt.getTime() - now) / 1000));
    const isBlocked = window.count > limit;

    return {
      totalHits: window.count,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }

  /**
   * Abre a janela desta chave, reaproveitando o documento vencido.
   *
   * O `upsert` cobre tanto a primeira chamada quanto o contador que o TTL do
   * Mongo ainda nao varreu — nos dois casos a janela nasce em 1, e nao somada
   * a de antes.
   */
  private async openWindow(key: string, now: number, ttl: number): Promise<OpenWindow> {
    const expiresAt = new Date(now + ttl);

    try {
      await this.hits
        .updateOne({ key }, { $set: { count: 1, expiresAt } }, { upsert: true })
        .exec();

      return { count: 1, expiresAt };
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      // A outra invocacao venceu a corrida do `upsert`: a janela dela ja vale,
      // e esta chamada so precisa ser contada dentro dela.
      const shared = await this.hits
        .findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: 'after' })
        .exec();

      return shared ?? { count: 1, expiresAt };
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
