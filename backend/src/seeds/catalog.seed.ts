import 'reflect-metadata';
import { parseArgs, runCatalogImport } from './catalog-command.js';
import { runSeed } from './seed-runner.js';

/**
 * `npm run seed:catalog`
 *
 * Lê `src/database/seeds/data/catalog.json` e importa categorias e produtos.
 *
 * ```
 * npm run seed:catalog
 * npm run seed:catalog -- --dry-run
 * npm run seed:catalog -- --only=asad-elixir
 * npm run seed:catalog -- --file=../outra-lista.json
 * ```
 *
 * Idempotente pelo slug: rodar duas vezes seguidas cria zero produtos na
 * segunda. Trocar um preço no arquivo e rodar de novo atualiza o preço e
 * deixa em paz a descrição, as fotos e o estoque que já estavam no banco.
 *
 * Este e o caminho da carga inicial. A rota `POST /admin/catalog/import` faz o
 * mesmo para quem não tem shell, mas corre contra o relógio da função
 * serverless; aqui não há relógio.
 *
 * O que o comando faz mora em `catalog-command.ts`, e não aqui: este arquivo e
 * só a casca que lê `process.argv`. A separação e o que permite ao teste rodar
 * o comando com flags diferentes sem executar nada no import.
 */
const options = parseArgs(process.argv.slice(2));

await runSeed('seed:catalog', async (app, logger) => {
  await runCatalogImport(app, logger, options);
});
