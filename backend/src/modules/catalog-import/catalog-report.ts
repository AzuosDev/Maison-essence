/**
 * O relatório da importação.
 *
 * Quem roda o comando precisa responder uma pergunta só: **deu certo, e o que
 * mudou?** Três linhas de contagem respondem a primeira parte; a lista de
 * falhas, com slug e motivo, responde a segunda — e e a única parte do
 * relatório que alguém vai reler amanha.
 *
 * As falhas vem com o slug na frente de propósito. "Produto inválido: o preço
 * deve ser um inteiro em centavos" manda procurar em 269 linhas; "asad-elixir:
 * o preço deve ser um inteiro em centavos" manda abrir uma.
 */

/** Uma entrada que não entrou, e por que. */
export interface ImportFailure {
  slug: string;
  reason: string;
}

export interface CategoryTally {
  created: number;
  updated: number;
  failed: number;
}

export interface ProductTally {
  created: number;
  updated: number;
  failed: number;
}

export interface VariantTally {
  created: number;
  deactivated: number;
}

/**
 * Os ids que esta execução criou.
 *
 * Só existe quando o cluster não suporta transação. Com transação a lista não
 * teria serventia: ou tudo entrou, ou nada entrou. Sem transação, ela e a
 * única maneira de desfazer uma importação que parou no meio — e por isso vai
 * para um arquivo no comando e para o corpo da resposta na rota, onde não há
 * disco para escrever.
 */
export interface RollbackLog {
  categoryIds: string[];
  productIds: string[];
}

export interface CatalogImportReport {
  categories: CategoryTally;
  products: ProductTally;
  variants: VariantTally;
  failures: ImportFailure[];
  /** Nada foi gravado: a execução só simulou. */
  dryRun: boolean;
  /** A importação inteira rodou dentro de uma transação. */
  transactional: boolean;
  /** Presente só na execução sem transação que gravou alguma coisa. */
  rollback?: RollbackLog;
  /**
   * Produtos que ficaram de fora porque o tempo acabou.
   *
   * Só aparece na rota, que roda com relógio: a importação para entre dois
   * lotes e diz quantos faltam. Como ela e idempotente, mandar o mesmo
   * arquivo de novo termina o serviço.
   */
  remaining?: number;
  durationMs: number;
}

export function emptyReport(): CatalogImportReport {
  return {
    categories: { created: 0, updated: 0, failed: 0 },
    products: { created: 0, updated: 0, failed: 0 },
    variants: { created: 0, deactivated: 0 },
    failures: [],
    dryRun: false,
    transactional: false,
    durationMs: 0,
  };
}

/**
 * O relatório em linhas, para o terminal.
 *
 * Uma linha por assunto, números alinhados. O cabeçalho avisa quando foi
 * simulação — a informação que muda o que a pessoa faz em seguida, e que por
 * isso vem antes dos números e não depois deles.
 */
export function formatReport(report: CatalogImportReport): string[] {
  const { categories, products, variants } = report;
  const lines = [
    report.dryRun
      ? 'Simulação (--dry-run): nada foi gravado.'
      : `Importação concluída em ${seconds(report.durationMs)}.`,
    `Categorias  ${categories.created} criadas, ${categories.updated} atualizadas, ` +
      `${categories.failed} com falha`,
    `Produtos    ${products.created} criados, ${products.updated} atualizados, ` +
      `${products.failed} com falha`,
    `Variantes   ${variants.created} criadas, ${variants.deactivated} desativadas`,
    report.transactional
      ? 'Transação   tudo dentro de uma só.'
      : 'Transação   não suportada por este cluster; gravado direto.',
  ];

  if (report.remaining !== undefined && report.remaining > 0) {
    lines.push(
      `Faltaram    ${report.remaining} produtos: o tempo acabou. ` +
        'Mande o mesmo arquivo de novo para terminar.',
    );
  }

  if (report.failures.length > 0) {
    lines.push('', `Falharam ${report.failures.length}:`);

    for (const failure of report.failures) {
      lines.push(`  ${failure.slug}: ${failure.reason}`);
    }
  }

  return lines;
}

function seconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}
