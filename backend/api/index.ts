import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

// Reaproveitado entre invocacoes da mesma instancia serverless: so o primeiro
// request paga o custo de subir o Nest.
let serverPromise: Promise<express.Express> | undefined;

async function createServer(): Promise<express.Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  configureApp(app);
  await app.init();

  return expressApp;
}

function getServer(): Promise<express.Express> {
  if (!serverPromise) {
    serverPromise = createServer().catch((error: unknown) => {
      // Permite que a proxima invocacao tente subir de novo.
      serverPromise = undefined;
      throw error;
    });
  }

  return serverPromise;
}

/**
 * TEMPORARIO — diagnostico do boot na Vercel.
 *
 * Quando o Nest nao sobe, a plataforma responde uma pagina generica
 * (`FUNCTION_INVOCATION_FAILED`) e o motivo fica so no log de runtime. Este
 * bloco devolve o motivo no corpo da resposta, para achar a causa sem
 * depender do painel.
 *
 * Mostra `name`, `message` e a pilha — e nada do ambiente. Ainda assim **sai
 * daqui assim que a API subir**: a pilha diz caminhos de arquivo e versoes de
 * pacote, que nao tem por que ficar publicos.
 *
 * Sem interruptor de ambiente de proposito: uma variavel a mais custaria mais
 * um ciclo de deploy para descobrir o que ja podia ser lido no proximo. So
 * responde quando o boot falha — com a API de pe, este caminho nao roda.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let server: express.Express;

  try {
    server = await getServer();
  } catch (error: unknown) {
    const erro = error instanceof Error ? error : new Error(String(error));

    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(
      [
        `${erro.name}: ${erro.message}`,
        '',
        erro.stack ?? '(sem pilha)',
        '',
        `causa: ${String((erro as { cause?: unknown }).cause ?? '(nenhuma)')}`,
      ].join('\n'),
    );

    return;
  }

  server(req, res);
}
