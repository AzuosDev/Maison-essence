import type { Logger } from '@nestjs/common';
import type { Connection } from 'mongoose';
// `STATES`, e nao `ConnectionStates`: o mongoose e CommonJS e o Node so
// enxerga como named export o que o lexer consegue detectar no dist.
import { STATES } from 'mongoose';

interface MongooseConnectionCache {
  connection?: Connection;
  promise?: Promise<Connection>;
}

// Symbol.for atravessa reavaliacoes deste modulo dentro do mesmo processo
// (hot reload, bundles duplicados), que e justamente quando o cache importa:
// a instancia serverless ja tem um socket aberto e nao deve abrir outro.
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

  // O driver reconecta sozinho quando o socket cai, entao "connecting" ainda
  // serve. So um close() explicito (app.close(), shutdown da funcao) e
  // definitivo: ali a conexao nunca mais volta e precisa ser recriada.
  return (
    connection.readyState !== STATES.disconnected &&
    connection.readyState !== STATES.uninitialized
  );
}

/**
 * Devolve a conexao da instancia serverless, abrindo o socket apenas na
 * primeira invocacao.
 *
 * Recebe a `Connection` que o `MongooseModule` acabou de criar porque nao ha
 * como impedir que ele crie a sua (ver `database.module.ts`): se o cache ja
 * estiver quente, a recem-criada e descartada.
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
    // Libera o cache para a proxima invocacao tentar conectar de novo, em vez
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
    logger.warn('Conexao com o MongoDB caiu');
  });

  connection.on('error', (error: unknown) => {
    logger.error(
      'Erro na conexao com o MongoDB',
      error instanceof Error ? error.stack : String(error),
    );
  });
}
