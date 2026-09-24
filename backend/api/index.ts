import { inspect } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';

// Reaproveitado entre invocações da mesma instância serverless: só o primeiro
// request paga o custo de subir o Nest.
let serverPromise: Promise<Express> | undefined;

/**
 * Importa um módulo dizendo qual era, quando ele não carrega.
 *
 * Os imports desta função são dinâmicos de propósito. No topo do arquivo eles
 * rodam antes de o handler existir, e um erro ali — um binário nativo que não
 * veio no pacote da função, um caminho que a Vercel resolveu diferente do
 * `tsc` — derruba o carregamento do módulo. A plataforma responde a página
 * genérica (`FUNCTION_INVOCATION_FAILED`) e o `try` lá embaixo nunca chega a
 * rodar, porque o arquivo inteiro falhou antes.
 *
 * Trazidos para dentro de uma função, eles falham no lugar onde já existe
 * quem os pegue. O nome vem junto porque `ERR_MODULE_NOT_FOUND` sem ele diz
 * que algo faltou, mas não o quê.
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

  // Este puxa a aplicação inteira, e com ela todo módulo nativo que algum
  // pacote carregue só de ser lido — o binário do argon2, entre eles.
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

/** O erro e a cadeia de causas dele, em texto. */
function relatorio(error: unknown): string {
  const linhas: string[] = [];
  let atual: unknown = error;
  let nivel = 0;

  while (atual !== undefined && atual !== null && nivel < 6) {
    if (!(atual instanceof Error)) {
      // `inspect` e não `String`: o que chega aqui pode ser um objeto
      // qualquer, e `[object Object]` não diagnostica nada.
      const valor = inspect(atual, { depth: 2 });

      linhas.push(nivel === 0 ? valor : `causado por: ${valor}`);

      break;
    }

    const codigo = (atual as { code?: unknown }).code;
    const titulo = `${atual.name}: ${atual.message}`;

    linhas.push(
      nivel === 0 ? titulo : `causado por ${titulo}`,
      codigo === undefined ? '' : `código: ${inspect(codigo)}`,
      atual.stack ?? '(sem pilha)',
      '',
    );

    atual = (atual as { cause?: unknown }).cause;
    nivel += 1;
  }

  return linhas.join('\n');
}

/**
 * TEMPORÁRIO — diagnóstico do boot na Vercel.
 *
 * Quando o Nest não sobe, a plataforma responde uma página genérica e o motivo
 * fica só no log de runtime. Este bloco devolve o motivo no corpo da resposta,
 * para achar a causa sem depender do painel.
 *
 * Mostra `name`, `message`, o código e a pilha — e nada do ambiente. Ainda
 * assim **sai daqui assim que a API subir**: a pilha diz caminhos de arquivo e
 * versões de pacote, que não têm por que ficar públicos.
 *
 * Sem interruptor de ambiente de propósito: uma variável a mais custaria mais
 * um ciclo de deploy para descobrir o que já podia ser lido no próximo. Só
 * responde quando o boot falha — com a API de pé, este caminho não roda.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let server: Express;

  try {
    server = await getServer();
  } catch (error: unknown) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(relatorio(error));

    return;
  }

  server(req, res);
}
