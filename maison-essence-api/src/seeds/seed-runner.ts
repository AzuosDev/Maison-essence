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
 * os indices, roda a tarefa e fecha a conexao.
 *
 * Erro nao vira stack trace crua no terminal e o processo sai com codigo 1 —
 * um seed que falha dentro de um script de deploy precisa parar o script.
 */
export async function runSeed(name: string, task: SeedTask): Promise<void> {
  const logger = new Logger(name);
  let app: INestApplicationContext | undefined;

  try {
    // Sobe calado e so depois liga o `log`: o "InstanceLoader ... dependencies
    // initialized" de cada modulo nao diz nada a quem rodou um seed, mas o que
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
 * Cria os indices que faltam antes de gravar qualquer coisa.
 *
 * `autoIndex` fica desligado fora de desenvolvimento (ver `database.module`),
 * entao um banco recem-criado no Atlas nao tem indice nenhum — nem o unico de
 * `users.email`, que e o que impede dois usuarios com o mesmo login. Como o
 * seed e a primeira coisa que roda contra esse banco, e aqui que os indices
 * nascem.
 *
 * `createIndexes` e nao `syncIndexes`: este so cria o que falta, enquanto o
 * outro apaga o que nao estiver no schema — nao e um comando de seed que deve
 * decidir derrubar indice de um banco em producao.
 */
async function ensureIndexes(app: INestApplicationContext, logger: Logger): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  const models = Object.values(connection.models);

  for (const model of models) {
    try {
      await model.createIndexes();
    } catch (error: unknown) {
      // Indice ja existente com outras opcoes: e divergencia entre o schema e
      // o banco, nao motivo para abortar o seed.
      logger.warn(
        `Indices de ${model.modelName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.log(`Indices conferidos em ${models.length} colecoes.`);
}
