import 'reflect-metadata';
import { parseArgs, runCatalogImport } from './catalog-command.js';
import { runSeed } from './seed-runner.js';

/**
 * `npm run seed:catalog`
 *
 * Le `src/database/seeds/data/catalog.json` e importa categorias e produtos.
 *
 * ```
 * npm run seed:catalog
 * npm run seed:catalog -- --dry-run
 * npm run seed:catalog -- --only=asad-elixir
 * npm run seed:catalog -- --file=../outra-lista.json
 * ```
 *
 * Idempotente pelo slug: rodar duas vezes seguidas cria zero produtos na
 * segunda. Trocar um preco no arquivo e rodar de novo atualiza o preco e
 * deixa em paz a descricao, as fotos e o estoque que ja estavam no banco.
 *
 * Este e o caminho da carga inicial. A rota `POST /admin/catalog/import` faz o
 * mesmo para quem nao tem shell, mas corre contra o relogio da funcao
 * serverless; aqui nao ha relogio.
 *
 * O que o comando faz mora em `catalog-command.ts`, e nao aqui: este arquivo e
 * so a casca que le `process.argv`. A separacao e o que permite ao teste rodar
 * o comando com flags diferentes sem executar nada no import.
 */
const options = parseArgs(process.argv.slice(2));

await runSeed('seed:catalog', async (app, logger) => {
  await runCatalogImport(app, logger, options);
});
