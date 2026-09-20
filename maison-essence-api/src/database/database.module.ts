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
        // Sem buffer a query falha na hora quando nao ha conexao, em vez de
        // ficar pendurada ate a funcao serverless estourar o tempo limite.
        bufferCommands: false,
        // Uma instancia serverless atende um request por vez; o pool existe
        // para as queries paralelas de um mesmo request.
        maxPoolSize: 10,
        // Zero: instancias ociosas nao seguram socket no Atlas, que tem limite
        // de conexoes simultaneas por cluster.
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // Sincronizar indices custa uma ida ao banco por schema a cada boot.
        // Em producao isso e trabalho do deploy, nao de cada cold start.
        autoIndex: config.get('NODE_ENV', { infer: true }) === 'development',
        // O MongooseModule sempre cria a propria Connection e nao aceita uma
        // pronta. Com lazyConnection ele para de esperar por ela, e o
        // connectionFactory abaixo decide o que devolver: a do cache global
        // se ja houver, senao esta mesma (ai sim aguardando o handshake).
        lazyConnection: true,
        connectionFactory: (connection: Connection): Promise<Connection> =>
          connectOnce(connection, logger),
      }),
    }),
  ],
})
export class DatabaseModule {}
