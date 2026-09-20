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

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = await getServer();

  server(req, res);
}
