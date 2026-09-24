import type { Logger } from '@nestjs/common';
import type { Connection } from 'mongoose';
// `STATES`, e não `ConnectionStates`: o mongoose e CommonJS e o Node só
// enxerga como named export o que o lexer consegue detectar no dist.
import { STATES } from 'mongoose';

interface MongooseConnectionCache {
  connection?: Connection;
  promise?: Promise<Connection>;
}

// Symbol.for atravessa reavaliações deste módulo dentro do mesmo processo
// (hot reload, bundles duplicados), que e justamente quando o cache importa:
// a instância serverless já tem um socket aberto e não deve abrir outro.
const CACHE_KEY: unique symbol = Symbol.for('maison-essence.mongoose-connection');

type GlobalWithCache = typeof globalThis & {
  [CACHE_KEY]?: MongooseConnectionCache;
};

function getCache(): MongooseConnectionCache {
  const scope = globalThis as GlobalWithCache;
  const cache = scope[CACHE_KEY] ?? {};

  scope[CACHE_KEY] = cache;

  return cache;
}

function isReusable(connection: Connection | undefined): boolean {
  if (!connection) {
    return false;
  }

  // O driver reconecta sozinho quando o socket cai, então "connecting" ainda
  // serve. Só um close() explicito (app.close(), shutdown da função) e
  // definitivo: ali a conexão nunca mais volta e precisa ser recriada.
  return (
    connection.readyState !== STATES.disconnected &&
    connection.readyState !== STATES.uninitialized
  );
}

/**
 * Devolve a conexão da instância serverless, abrindo o socket apenas na
 * primeira invocação.
 *
 * Recebe a `Connection` que o `MongooseModule` acabou de criar porque não há
 * como impedir que ele crie a sua (ver `database.module.ts`): se o cache já
 * estiver quente, a recém-criada e descartada.
 */
export function connectOnce(connection: Connection, logger: Logger): Promise<Connection> {
  const cache = getCache();

  if (cache.promise && isReusable(cache.connection)) {
    void connection.close().catch(() => undefined);

    return cache.promise;
  }

  registerLogging(connection, logger);

  cache.connection = connection;
  cache.promise = connection.asPromise().catch((error: unknown) => {
    // Libera o cache para a próxima invocação tentar conectar de novo, em vez
    // de servir uma promise rejeitada para sempre.
    cache.connection = undefined;
    cache.promise = undefined;

    throw error;
  });

  return cache.promise;
}

function registerLogging(connection: Connection, logger: Logger): void {
  connection.on('connected', () => {
    logger.log(`Conectado ao MongoDB (banco "${connection.name}")`);
  });

  connection.on('disconnected', () => {
    logger.warn('Conexão com o MongoDB caiu');
  });

  connection.on('error', (error: unknown) => {
    logger.error(
      'Erro na conexão com o MongoDB',
      error instanceof Error ? error.stack : String(error),
    );
  });
}
