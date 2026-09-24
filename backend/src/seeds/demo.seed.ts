import 'reflect-metadata';
import { DemoSeedService } from './demo-seed.service.js';
import { runSeed } from './seed-runner.js';

/**
 * `npm run seed:demo`
 *
 * Popula a loja com três categorias, seis produtos com variantes, duas
 * cidades de entrega e as configurações padrão — o bastante para abrir o
 * frontend e ver uma loja de verdade sem cadastrar nada a mão.
 *
 * `npm run seed:demo -- --force` para rodar com `NODE_ENV=production`.
 */
const force = process.argv.slice(2).includes('--force');

await runSeed('seed:demo', async (app) => {
  const seed = app.get(DemoSeedService);

  seed.report(await seed.run({ force }));
});
