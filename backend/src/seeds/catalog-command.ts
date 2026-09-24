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
 * A separacao existe para que o comando seja **testavel**: `catalog.seed.ts`
 * e um modulo com `await` no topo que le `process.argv` — importa-lo num teste
 * executaria a importacao no ato, uma vez so e com as flags erradas. Aqui as
 * flags sao um argumento, e o teste roda o comando quantas vezes quiser.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * O arquivo padrao.
 *
 * Relativo a este modulo, e por isso vale igual em `src/` e em `dist/`: o
 * `nest build` copia a pasta de dados mantendo a arvore (ver `assets` em
 * `nest-cli.json`). Um caminho a partir do diretorio de trabalho quebraria
 * conforme a pasta de onde o comando fosse chamado.
 */
export const DEFAULT_CATALOG_PATH = resolve(HERE, '../database/seeds/data/catalog.json');

/** Onde o log de rollback cai quando a importacao rodou sem transacao. */
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
 * Le o arquivo, importa e escreve o relatorio.
 *
 * Falha de entrada nao derruba o comando: o relatorio ja listou o que nao
 * entrou, e as outras entradas foram gravadas. Sair com codigo 1 faria um
 * script de deploy parar por causa de um preco digitado errado numa linha.
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
    // funcao serverless, que e morta pelo relogio.
    //
    // O ator vai sem papel: quem rodou o comando tinha a URI do banco na mao,
    // nao um papel do painel. A trilha diz `seed:catalog`, que e a verdade.
    actor: { id: 'seed:catalog', email: 'seed:catalog' },
  });

  for (const line of formatReport(report)) {
    logger.log(line);
  }

  writeRollback(report, logger);

  return report;
}

/** Le e interpreta o arquivo, trocando os erros do `fs` por uma frase util. */
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
 * Grava os ids do que nasceu, quando nao houve transacao.
 *
 * E a unica forma de desfazer uma importacao que parou no meio num cluster sem
 * replica set. Nao e gravado quando houve transacao — ou tudo entrou, ou nada
 * entrou — nem quando nada nasceu, porque nao ha o que desfazer.
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
