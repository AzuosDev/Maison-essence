import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MongooseModuleFactoryOptions } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Env } from '../config/env.schema.js';
import { connectOnce } from './connection-cache.js';

const logger = new Logger('MongooseConnection');

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MongooseModuleFactoryOptions => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        dbName: config.get('MONGODB_DB_NAME', { infer: true }),
        // Sem buffer a query falha na hora quando não há conexão, em vez de
        // ficar pendurada até a função serverless estourar o tempo limite.
        bufferCommands: false,
        // Uma instância serverless atende um request por vez; o pool existe
        // para as queries paralelas de um mesmo request.
        maxPoolSize: 10,
        // Zero: instâncias ociosas não seguram socket no Atlas, que tem limite
        // de conexões simultaneas por cluster.
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
        // Sem repetir. O padrão do MongooseModule e tentar dez vezes, com
        // três segundos entre elas, e numa função serverless isso e o pior
        // dos dois mundos: o cliente espera mais de um minuto e, no fim, o
        // Nest derruba o processo — a plataforma responde a própria página de
        // erro e o motivo fica só no log. Banco fora do ar com uma tentativa
        // falha em cinco segundos e responde 503 dizendo o que houve; a
        // invocação seguinte tenta de novo com o cache de conexão limpo (ver
        // `connection-cache.ts`), que e o retry que este desenho já tinha.
        retryAttempts: 0,
        socketTimeoutMS: 45000,
        // Sincronizar índices custa uma ida ao banco por schema a cada boot.
        // Em produção isso e trabalho do deploy, não de cada cold start.
        autoIndex: config.get('NODE_ENV', { infer: true }) === 'development',
        // O MongooseModule sempre cria a própria Connection e não aceita uma
        // pronta. Com lazyConnection ele para de esperar por ela, e o
        // connectionFactory abaixo decide o que devolver: a do cache global
        // se já houver, senão esta mesma (aí sim aguardando o handshake).
        lazyConnection: true,
        connectionFactory: (connection: Connection): Promise<Connection> =>
          connectOnce(connection, logger),
      }),
    }),
  ],
})
export class DatabaseModule {}
