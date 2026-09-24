import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { CatalogFormatError } from '../modules/catalog-import/catalog-file.js';
import { CatalogImportService } from '../modules/catalog-import/catalog-import.service.js';
import { formatReport } from '../modules/catalog-import/catalog-report.js';
import type { CatalogImportReport } from '../modules/catalog-import/catalog-report.js';

/**
 * O corpo do `npm run seed:catalog`, separado do arquivo que o `node` executa.
 *
 * A separação existe para que o comando seja **testável**: `catalog.seed.ts`
 * e um módulo com `await` no topo que lê `process.argv` — importa-lo num teste
 * executaria a importação no ato, uma vez só e com as flags erradas. Aqui as
 * flags são um argumento, e o teste roda o comando quantas vezes quiser.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * O arquivo padrão.
 *
 * Relativo a este módulo, e por isso vale igual em `src/` e em `dist/`: o
 * `nest build` copia a pasta de dados mantendo a árvore (ver `assets` em
 * `nest-cli.json`). Um caminho a partir do diretório de trabalho quebraria
 * conforme a pasta de onde o comando fosse chamado.
 */
export const DEFAULT_CATALOG_PATH = resolve(HERE, '../database/seeds/data/catalog.json');

/** Onde o log de rollback cai quando a importação rodou sem transação. */
export const ROLLBACK_DIR = resolve(HERE, '../../.catalog-import');

export interface CatalogCommandOptions {
  dryRun: boolean;
  only?: string;
  file: string;
}

/** `--dry-run`, `--only=<slug>` e `--file=<caminho>` como o comando os recebe. */
export function parseArgs(argv: readonly string[]): CatalogCommandOptions {
  return {
    dryRun: argv.includes('--dry-run'),
    only: valueOf(argv, '--only'),
    file: valueOf(argv, '--file') ?? DEFAULT_CATALOG_PATH,
  };
}

/**
 * Lê o arquivo, importa e escreve o relatório.
 *
 * Falha de entrada não derruba o comando: o relatório já listou o que não
 * entrou, e as outras entradas foram gravadas. Sair com código 1 faria um
 * script de deploy parar por causa de um preço digitado errado numa linha.
 */
export async function runCatalogImport(
  app: INestApplicationContext,
  logger: Logger,
  options: CatalogCommandOptions,
): Promise<CatalogImportReport> {
  const raw = readCatalogFile(options.file);

  logger.log(`Arquivo: ${options.file}`);

  const report = await app.get(CatalogImportService).import(raw, {
    dryRun: options.dryRun,
    only: options.only,
    // Sem prazo: quem roda um comando pode esperar. O teto existe para a
    // função serverless, que e morta pelo relógio.
    //
    // O ator vai sem papel: quem rodou o comando tinha a URI do banco na mão,
    // não um papel do painel. A trilha diz `seed:catalog`, que e a verdade.
    actor: { id: 'seed:catalog', email: 'seed:catalog' },
  });

  for (const line of formatReport(report)) {
    logger.log(line);
  }

  writeRollback(report, logger);

  return report;
}

/** Lê e interpreta o arquivo, trocando os erros do `fs` por uma frase útil. */
export function readCatalogFile(path: string): unknown {
  let content: string;

  try {
    content = readFileSync(path, 'utf8');
  } catch {
    throw new CatalogFormatError(
      `Não encontrei o arquivo ${path}. Use --file=<caminho> para apontar outro.`,
    );
  }

  try {
    return JSON.parse(content);
  } catch (error: unknown) {
    throw new CatalogFormatError(
      `O arquivo ${path} não e um JSON válido: ${error instanceof Error ? error.message : ''}`,
    );
  }
}

/**
 * Grava os ids do que nasceu, quando não houve transação.
 *
 * E a única forma de desfazer uma importação que parou no meio num cluster sem
 * replica set. Não e gravado quando houve transação — ou tudo entrou, ou nada
 * entrou — nem quando nada nasceu, porque não há o que desfazer.
 */
function writeRollback(report: CatalogImportReport, logger: Logger): void {
  const rollback = report.rollback;

  if (rollback === undefined) {
    return;
  }

  const total = rollback.categoryIds.length + rollback.productIds.length;

  if (total === 0) {
    return;
  }

  const path = resolve(ROLLBACK_DIR, `catalog-import-${Date.now()}.json`);

  mkdirSync(ROLLBACK_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(rollback, null, 2)}\n`, 'utf8');

  logger.log(`Sem transação: os ${total} ids criados ficaram em ${path}`);
}

/** `--only=asad-elixir` e `--only asad-elixir` valem o mesmo. */
function valueOf(args: readonly string[], flag: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));

  if (inline !== undefined) {
    return inline.slice(flag.length + 1);
  }

  const index = args.indexOf(flag);
  const next = index === -1 ? undefined : args[index + 1];

  return next !== undefined && !next.startsWith('--') ? next : undefined;
}
