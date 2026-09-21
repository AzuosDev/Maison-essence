import 'reflect-metadata';
import {
  BOOTSTRAP_ORIGINS,
  BOOTSTRAP_OUTCOMES,
  BootstrapService,
} from '../modules/auth/bootstrap.service.js';
import { runSeed } from './seed-runner.js';

/**
 * `npm run seed:superadmin`
 *
 * Cria o primeiro usuario do painel a partir de `BOOTSTRAP_SUPERADMIN_EMAIL` e
 * `BOOTSTRAP_SUPERADMIN_PASSWORD`. Quem faz o trabalho e o `BootstrapService`,
 * o mesmo de `POST /auth/bootstrap`.
 *
 * Idempotente: com um SUPER_ADMIN ja no banco ele avisa e nao cria nada, e
 * sai com codigo 0 — rodar duas vezes nao e erro, e o caso normal de quem nao
 * lembra se ja rodou.
 */
await runSeed('seed:superadmin', async (app, logger) => {
  const result = await app.get(BootstrapService).run({
    origin: BOOTSTRAP_ORIGINS.CLI,
    // Diferente da rota: aqui basta nao haver SUPER_ADMIN. Quem roda o
    // comando ja tem a URI do banco na mao, nao ha o que proteger alem da
    // idempotencia.
    requireEmptyDatabase: false,
  });

  if (result.outcome === BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED) {
    logger.warn(
      `Ja existe um SUPER_ADMIN (${result.blockedBy.email}). Nada foi criado. ` +
        'Para outro administrador, use o painel; para recuperar o acesso, ' +
        'resete a senha por la.',
    );

    return;
  }

  logger.log(`SUPER_ADMIN criado: ${result.user.email}`);
  logger.log(
    'A senha veio da variavel de ambiente e o usuario nasce com troca ' +
      'obrigatoria: no primeiro acesso o painel so libera PATCH /auth/change-password.',
  );
});
