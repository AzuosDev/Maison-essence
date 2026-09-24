import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import type { RequestHandler } from 'express';
import type {
  CorsOptions,
} from '@nestjs/common/interfaces/external/cors-options.interface.js';
import helmetImport from 'helmet';
import type { HelmetOptions } from 'helmet';
import { JsonLogger, logLevelsFor } from './common/json-logger.js';
import { rejectMongoOperators } from './common/mongo-operator-guard.js';
import { attachRequestId } from './common/request-id.middleware.js';
import { apiSecurityHeaders, docsSecurityHeaders } from './common/security-headers.js';
import { setupSwagger } from './common/swagger.js';
import { MAX_IMPORT_BODY_SIZE } from './modules/catalog-import/catalog-import.constants.js';
import type { Env } from './config/env.schema.js';
import { parseCorsOrigins } from './config/env.schema.js';

/**
 * `helmet`, garantidamente chamavel.
 *
 * ## O que quebrava
 *
 * O build da Vercel parava com `TS2349: This expression is not callable` nas
 * duas chamadas de `helmet(...)`, dizendo que
 * `typeof import(".../helmet/index")` nao tem assinatura de chamada. Aqui o
 * mesmo codigo compila: `tsc`, `nest build` e os testes passam.
 *
 * A diferenca esta em **como cada compilador resolve o pacote**. O helmet 8
 * nao tem `index.d.ts`: sao dois arquivos, `index.d.mts` e `index.d.cts`,
 * escolhidos pelo campo `exports`. Os dois declaram a funcao como
 * `export default`. Quando o arquivo que importa e tratado como CommonJS e o
 * compilador nao esta com `esModuleInterop` ligado, o binding do import
 * default passa a ser tipado como o **namespace do modulo** — um objeto com
 * `contentSecurityPolicy`, `hsts` e os demais, mas sem assinatura de chamada.
 * Dai o erro. A mensagem da Vercel nao traz o `resolution-mode: "import"` que
 * o TypeScript imprime no caminho resolvido como ESM, e e isso que denuncia o
 * modo CommonJS.
 *
 * ## Por que um `as` resolve, e por que e seguro
 *
 * O problema e so de tipo. Em tempo de execucao os dois caminhos chegam na
 * mesma funcao: o `index.cjs` do pacote termina com
 * `module.exports = exports.default` seguido de
 * `module.exports.default = module.exports`, entao `require('helmet')` e
 * `require('helmet').default` sao o mesmo valor chamavel. Nenhum emit muda de
 * comportamento por causa desta linha.
 *
 * O `as` tambem nao afrouxa o que interessa: o argumento continua sendo
 * `HelmetOptions`, e `apiSecurityHeaders()` e `docsSecurityHeaders()` seguem
 * conferidos nas duas chamadas.
 *
 * Os outros pacotes importados por default aqui — `compression`,
 * `cookie-parser`, `express` — nao precisam disto: os tipos deles vem de
 * `@types/*` com `export =`, que atravessa os dois modos sem ambiguidade. So
 * o helmet declara os proprios tipos com `export default`.
 */
const helmet = helmetImport as unknown as (
  options?: Readonly<HelmetOptions>,
) => RequestHandler;

export const GLOBAL_PREFIX = 'api/v1';

/** Onde mora a documentação. Atrás de senha em produção (ver `swagger.ts`). */
export const DOCS_PATH = `${GLOBAL_PREFIX}/docs`;

/**
 * Teto do corpo da requisição.
 *
 * O maior corpo legitimo desta API e um produto com variantes e descrição, ou
 * uma página institucional inteira — alguns poucos KB. Nenhuma imagem passa por
 * aqui: o upload e assinado e vai do navegador direto para o Cloudinary. O
 * padrão do Express e 100 KB; 256 KB deixa folga para a página institucional
 * mais longa e continua sendo barato de recusar numa função serverless, onde
 * memória e tempo são cobrados.
 */
export const MAX_BODY_SIZE = '256kb';

/** O único caminho que recebe corpo maior que `MAX_BODY_SIZE`. */
export const CATALOG_IMPORT_PATH = `${GLOBAL_PREFIX}/admin/catalog/import`;

/**
 * O parser da importação de catálogo: 1 MB, e sem o cifrão do arquivo.
 *
 * Duas coisas acontecem aqui, e as duas existem para que o arquivo que a
 * ferramenta gera possa ser colado inteiro no corpo, sem edição a mão.
 *
 * **O tamanho.** O catálogo tem 175 KB e cresce a cada lista de fornecedor;
 * o teto geral da API e 256 KB, calibrado para um produto por vez. Subir o
 * teto geral para caber a importação deixaria toda rota da API aceitando 1 MB
 * — e o custo de recusar um corpo grande numa função serverless e cobrado em
 * memória e tempo. Então o teto sobe em um caminho só.
 *
 * **O `$schema`.** O arquivo se identifica com `"$schema": "maison-essence/
 * catalog@1"` na primeira linha, e o guard de operadores do Mongo recusa
 * qualquer chave iniciada por cifrão — com razão: e assim que `{"$ne": null}`
 * entra numa consulta. Abrir exceção no guard seria trocar uma defesa geral
 * por uma conveniência; então a chave e **removida** aqui, no nível de cima do
 * corpo, antes de o guard olhar. Nada passa a ser confiado: o que sobra
 * continua sendo inspecionado inteiro, e o `$schema` era metadado que a
 * importação nunca leu.
 */
function catalogImportParser(): RequestHandler {
  const parse = json({ limit: MAX_IMPORT_BODY_SIZE });

  return (request, response, next) => {
    parse(request, response, (error?: unknown) => {
      if (error !== undefined && error !== null) {
        next(error);

        return;
      }

      const body: unknown = request.body;

      if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
        for (const key of Object.keys(body)) {
          if (key.startsWith('$')) {
            delete (body as Record<string, unknown>)[key];
          }
        }
      }

      next();
    });
  };
}

/**
 * Tudo o que a aplicação precisa além dos módulos.
 *
 * Mora aqui, e não no `main.ts`, porque são três entradas: o servidor local, a
 * função serverless da Vercel (`api/index.ts`) e os testes e2e. Configuração de
 * segurança que valesse só em uma delas seria uma segurança que não existe.
 *
 * A ordem dos middlewares e a própria defesa e não e alfabética:
 *
 * 1. os parsers, com o teto de tamanho, para que nada grande seja lido;
 * 2. o `requestId`, para que tudo o que vier depois — inclusive uma recusa —
 *    apareca no log com o mesmo identificador;
 * 3. os cabeçalhos de segurança, que precisam valer até para a resposta de
 *    erro dos middlewares seguintes;
 * 4. a recusa de operador do Mongo, que lê o corpo já convertido;
 * 5. o CORS e as rotas.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config: ConfigService<Env, true> = app.get(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const origins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));
  const docsUser = config.get('DOCS_USER', { infer: true });
  const docsPassword = config.get('DOCS_PASSWORD', { infer: true });

  // Antes de qualquer outra coisa: o que este método registrar já sai no
  // formato de log da aplicação.
  app.useLogger(new JsonLogger(logLevelsFor(nodeEnv)));

  // Os parsers precisam ser trocados antes do `init()`, que registra os
  // padrão de 100 KB — o adaptador pula os dele ao ver que já há um parser
  // do mesmo tipo montado.
  const express = app as NestExpressApplication;

  // Antes dos parsers gerais, e só no caminho da importação: o primeiro a
  // interpretar o corpo vence, e os seguintes o deixam em paz.
  app.use(`/${CATALOG_IMPORT_PATH}`, catalogImportParser());

  express.useBodyParser('json', { limit: MAX_BODY_SIZE });
  express.useBodyParser('urlencoded', { limit: MAX_BODY_SIZE, extended: true });

  app.use(attachRequestId());
  app.use(helmet(apiSecurityHeaders()));
  // Montado depois, no caminho da documentação: o último a escrever o
  // cabeçalho vence, e só ali a política precisa deixar carregar script.
  app.use(`/${DOCS_PATH}`, helmet(docsSecurityHeaders()));
  app.use(compression());
  // Os tokens de sessão chegam em cookie httpOnly; sem o parser, req.cookies
  // não existe e só o caminho do Bearer funcionaria.
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
 * A função no lugar da lista existe por causa de `credentials: true`: com ele,
 * o navegador exige que a resposta diga exatamente qual origem foi liberada, e
 * um `*` seria recusado por ele mesmo — ou, pior, aceito por um cliente que
 * não e navegador. Origem desconhecida não vira erro; ela apenas não recebe os
 * cabeçalhos, e quem barra a leitura e o navegador, que e quem sabe de quem e
 * a página que chamou.
 *
 * Requisição sem `Origin` passa: não e navegador — e o `curl` da dona, o
 * monitor de saúde, o teste e2e —, e nenhum deles carrega cookie de sessão de
 * ninguém.
 */
function corsFor(origins: readonly string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, origin === undefined || origins.includes(origin));
    },
    credentials: true,
    // Guarda o preflight por dez minutos: o checkout faz várias chamadas
    // seguidas, e repetir o OPTIONS a cada uma custa uma ida ao servidor.
    maxAge: 600,
  };
}
