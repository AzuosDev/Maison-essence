import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { SeedModule } from './seed.module.js';

export type SeedTask = (app: INestApplicationContext, logger: Logger) => Promise<void>;

/**
 * Casca comum dos comandos de seed: sobe o contexto do Nest sem HTTP, confere
 * os índices, roda a tarefa e fecha a conexão.
 *
 * Erro não vira stack trace crua no terminal e o processo sai com código 1 —
 * um seed que falha dentro de um script de deploy precisa parar o script.
 */
export async function runSeed(name: string, task: SeedTask): Promise<void> {
  const logger = new Logger(name);
  let app: INestApplicationContext | undefined;

  try {
    // Sobe calado e só depois liga o `log`: o "InstanceLoader ... dependencies
    // initialized" de cada módulo não diz nada a quem rodou um seed, mas o que
    // o seed tem a dizer, sim.
    app = await NestFactory.createApplicationContext(SeedModule, {
      abortOnError: false,
      logger: ['warn', 'error'],
    });

    app.useLogger(['log', 'warn', 'error']);

    await ensureIndexes(app, logger);
    await task(app, logger);
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await app?.close();
  }
}

/**
 * Cria os índices que faltam antes de gravar qualquer coisa.
 *
 * `autoIndex` fica desligado fora de desenvolvimento (ver `database.module`),
 * então um banco recém-criado no Atlas não tem índice nenhum — nem o único de
 * `users.email`, que e o que impede dois usuários com o mesmo login. Como o
 * seed e a primeira coisa que roda contra esse banco, e aqui que os índices
 * nascem.
 *
 * `createIndexes` e não `syncIndexes`: este só cria o que falta, enquanto o
 * outro apaga o que não estiver no schema — não e um comando de seed que deve
 * decidir derrubar índice de um banco em produção.
 */
async function ensureIndexes(app: INestApplicationContext, logger: Logger): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  const models = Object.values(connection.models);

  for (const model of models) {
    try {
      await model.createIndexes();
    } catch (error: unknown) {
      // Índice já existente com outras opções: e divergência entre o schema e
      // o banco, não motivo para abortar o seed.
      logger.warn(
        `Índices de ${model.modelName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.log(`Índices conferidos em ${models.length} coleções.`);
}
