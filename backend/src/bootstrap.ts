import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type {
  CorsOptions,
} from '@nestjs/common/interfaces/external/cors-options.interface.js';
import helmet from 'helmet';
import { JsonLogger, logLevelsFor } from './common/json-logger.js';
import { rejectMongoOperators } from './common/mongo-operator-guard.js';
import { attachRequestId } from './common/request-id.middleware.js';
import { apiSecurityHeaders, docsSecurityHeaders } from './common/security-headers.js';
import { setupSwagger } from './common/swagger.js';
import type { Env } from './config/env.schema.js';
import { parseCorsOrigins } from './config/env.schema.js';

export const GLOBAL_PREFIX = 'api/v1';

/** Onde mora a documentacao. Atras de senha em producao (ver `swagger.ts`). */
export const DOCS_PATH = `${GLOBAL_PREFIX}/docs`;

/**
 * Teto do corpo da requisicao.
 *
 * O maior corpo legitimo desta API e um produto com variantes e descricao, ou
 * uma pagina institucional inteira — alguns poucos KB. Nenhuma imagem passa por
 * aqui: o upload e assinado e vai do navegador direto para o Cloudinary. O
 * padrao do Express e 100 KB; 256 KB deixa folga para a pagina institucional
 * mais longa e continua sendo barato de recusar numa funcao serverless, onde
 * memoria e tempo sao cobrados.
 */
export const MAX_BODY_SIZE = '256kb';

/**
 * Tudo o que a aplicacao precisa alem dos modulos.
 *
 * Mora aqui, e nao no `main.ts`, porque sao tres entradas: o servidor local, a
 * funcao serverless da Vercel (`api/index.ts`) e os testes e2e. Configuracao de
 * seguranca que valesse so em uma delas seria uma seguranca que nao existe.
 *
 * A ordem dos middlewares e a propria defesa e nao e alfabetica:
 *
 * 1. os parsers, com o teto de tamanho, para que nada grande seja lido;
 * 2. o `requestId`, para que tudo o que vier depois — inclusive uma recusa —
 *    apareca no log com o mesmo identificador;
 * 3. os cabecalhos de seguranca, que precisam valer ate para a resposta de
 *    erro dos middlewares seguintes;
 * 4. a recusa de operador do Mongo, que le o corpo ja convertido;
 * 5. o CORS e as rotas.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config: ConfigService<Env, true> = app.get(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const origins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));
  const docsUser = config.get('DOCS_USER', { infer: true });
  const docsPassword = config.get('DOCS_PASSWORD', { infer: true });

  // Antes de qualquer outra coisa: o que este metodo registrar ja sai no
  // formato de log da aplicacao.
  app.useLogger(new JsonLogger(logLevelsFor(nodeEnv)));

  // Os parsers precisam ser trocados antes do `init()`, que registra os
  // padrao de 100 KB — o adaptador pula os dele ao ver que ja ha um parser
  // do mesmo tipo montado.
  const express = app as NestExpressApplication;

  express.useBodyParser('json', { limit: MAX_BODY_SIZE });
  express.useBodyParser('urlencoded', { limit: MAX_BODY_SIZE, extended: true });

  app.use(attachRequestId());
  app.use(helmet(apiSecurityHeaders()));
  // Montado depois, no caminho da documentacao: o ultimo a escrever o
  // cabecalho vence, e so ali a politica precisa deixar carregar script.
  app.use(`/${DOCS_PATH}`, helmet(docsSecurityHeaders()));
  app.use(compression());
  // Os tokens de sessao chegam em cookie httpOnly; sem o parser, req.cookies
  // nao existe e so o caminho do Bearer funcionaria.
  app.use(cookieParser());
  app.use(rejectMongoOperators());
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableCors(corsFor(origins));

  setupSwagger(app, {
    path: DOCS_PATH,
    version: config.get('APP_VERSION', { infer: true }),
    isProduction: nodeEnv === 'production',
    ...(docsUser && docsPassword
      ? { credentials: { user: docsUser, password: docsPassword } }
      : {}),
  });

  return app;
}

/**
 * CORS pela lista, sem curinga.
 *
 * A funcao no lugar da lista existe por causa de `credentials: true`: com ele,
 * o navegador exige que a resposta diga exatamente qual origem foi liberada, e
 * um `*` seria recusado por ele mesmo — ou, pior, aceito por um cliente que
 * nao e navegador. Origem desconhecida nao vira erro; ela apenas nao recebe os
 * cabecalhos, e quem barra a leitura e o navegador, que e quem sabe de quem e
 * a pagina que chamou.
 *
 * Requisicao sem `Origin` passa: nao e navegador — e o `curl` da dona, o
 * monitor de saude, o teste e2e —, e nenhum deles carrega cookie de sessao de
 * ninguem.
 */
function corsFor(origins: readonly string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, origin === undefined || origins.includes(origin));
    },
    credentials: true,
    // Guarda o preflight por dez minutos: o checkout faz varias chamadas
    // seguidas, e repetir o OPTIONS a cada uma custa uma ida ao servidor.
    maxAge: 600,
  };
}
