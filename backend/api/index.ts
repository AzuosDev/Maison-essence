import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
// O único import estático daqui. Não traz o Nest nem pacote externo junto —
// só `node:http` —, e existe justamente para quem responde fora do filtro de
// exceções, que e o caso quando a aplicação não chegou a subir.
import { errorResponseBody } from '../src/common/error-response.js';

// Reaproveitado entre invocações da mesma instância serverless: só o primeiro
// request paga o custo de subir o Nest.
let serverPromise: Promise<Express> | undefined;

/**
 * Importa um módulo dizendo qual era, quando ele não carrega.
 *
 * Os imports desta função são dinâmicos de propósito. No topo do arquivo eles
 * rodam antes de o handler existir, e um erro ali — um binário nativo que não
 * veio no pacote da função, um pacote CommonJS que faz `require()` de um ESM —
 * derruba o carregamento do módulo inteiro. A plataforma responde a página
 * genérica (`FUNCTION_INVOCATION_FAILED`) e o `try` lá embaixo nunca chega a
 * rodar, porque o arquivo falhou antes de existir.
 *
 * Trazidos para dentro de uma função, eles falham onde já existe quem os
 * pegue. O nome vem junto porque `ERR_REQUIRE_ESM` sem ele diz que dois
 * formatos se desentenderam, mas não entre quais pacotes.
 */
async function carregar<T>(nome: string, importar: () => Promise<T>): Promise<T> {
  try {
    return await importar();
  } catch (error: unknown) {
    throw new Error(`não consegui carregar ${nome}`, { cause: error });
  }
}

async function createServer(): Promise<Express> {
  // A ordem importa: `reflect-metadata` instala o que os decorators do Nest
  // leem, e precisa estar de pé antes do primeiro `@Module` ser avaliado.
  await carregar('reflect-metadata', () => import('reflect-metadata'));

  const { NestFactory } = await carregar('@nestjs/core', () => import('@nestjs/core'));
  const { ExpressAdapter } = await carregar(
    '@nestjs/platform-express',
    () => import('@nestjs/platform-express'),
  );
  const { default: express } = await carregar('express', () => import('express'));

  // Este puxa a aplicação inteira, e com ela todo módulo que algum pacote
  // carregue só de ser lido.
  const { AppModule } = await carregar(
    '../src/app.module.js',
    () => import('../src/app.module.js'),
  );
  const { configureApp } = await carregar(
    '../src/bootstrap.js',
    () => import('../src/bootstrap.js'),
  );

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  configureApp(app);
  await app.init();

  return expressApp;
}

function getServer(): Promise<Express> {
  if (!serverPromise) {
    serverPromise = createServer().catch((error: unknown) => {
      // Permite que a próxima invocação tente subir de novo.
      serverPromise = undefined;
      throw error;
    });
  }

  return serverPromise;
}

const BOOT_FAILED_MESSAGE = 'A API está indisponível no momento. Tente de novo em instantes.';

/**
 * A porta da função serverless.
 *
 * O `try` existe porque uma falha de boot não tem filtro de exceções para
 * pega-la: o Nest não subiu, e sem ele a plataforma responderia a própria
 * página de erro. Aqui ela vira uma resposta no formato da API, igual a
 * qualquer outra recusa.
 *
 * O motivo vai para o log de runtime, e só para lá. Já esteve no corpo da
 * resposta, enquanto se caçava por que a função não subia, e foi assim que se
 * achou o `ERR_REQUIRE_ESM` do throttler — mas a pilha diz caminhos de arquivo
 * e versões de pacote, e isso e mapa para quem procura vulnerabilidade
 * conhecida. `vercel logs` mostra o mesmo texto para quem tem acesso ao
 * projeto, que e quem precisa dele.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let server: Express;

  try {
    server = await getServer();
  } catch (error: unknown) {
    // `console.error` e não o logger do Nest: ele não existe quando o boot e
    // o que falhou. A cadeia de `cause` sai junto, com o nome do módulo.
    console.error('Falha ao subir a aplicação', error);

    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    // Cold start com o banco de pé leva cinco segundos; e o que se pede para
    // esperar antes de tentar de novo.
    res.setHeader('retry-after', '5');
    res.end(
      JSON.stringify(
        errorResponseBody(
          { statusCode: 503, message: BOOT_FAILED_MESSAGE },
          req.url ?? '/',
        ),
      ),
    );

    return;
  }

  server(req, res);
}
