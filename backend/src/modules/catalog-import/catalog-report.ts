/**
 * O relatorio da importacao.
 *
 * Quem roda o comando precisa responder uma pergunta so: **deu certo, e o que
 * mudou?** Tres linhas de contagem respondem a primeira parte; a lista de
 * falhas, com slug e motivo, responde a segunda — e e a unica parte do
 * relatorio que alguem vai reler amanha.
 *
 * As falhas vem com o slug na frente de proposito. "Produto invalido: o preco
 * deve ser um inteiro em centavos" manda procurar em 269 linhas; "asad-elixir:
 * o preco deve ser um inteiro em centavos" manda abrir uma.
 */

/** Uma entrada que nao entrou, e por que. */
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
 * Os ids que esta execucao criou.
 *
 * So existe quando o cluster nao suporta transacao. Com transacao a lista nao
 * teria serventia: ou tudo entrou, ou nada entrou. Sem transacao, ela e a
 * unica maneira de desfazer uma importacao que parou no meio — e por isso vai
 * para um arquivo no comando e para o corpo da resposta na rota, onde nao ha
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
  /** Nada foi gravado: a execucao so simulou. */
  dryRun: boolean;
  /** A importacao inteira rodou dentro de uma transacao. */
  transactional: boolean;
  /** Presente so na execucao sem transacao que gravou alguma coisa. */
  rollback?: RollbackLog;
  /**
   * Produtos que ficaram de fora porque o tempo acabou.
   *
   * So aparece na rota, que roda com relogio: a importacao para entre dois
   * lotes e diz quantos faltam. Como ela e idempotente, mandar o mesmo
   * arquivo de novo termina o servico.
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
 * O relatorio em linhas, para o terminal.
 *
 * Uma linha por assunto, numeros alinhados. O cabecalho avisa quando foi
 * simulacao — a informacao que muda o que a pessoa faz em seguida, e que por
 * isso vem antes dos numeros e nao depois deles.
 */
export function formatReport(report: CatalogImportReport): string[] {
  const { categories, products, variants } = report;
  const lines = [
    report.dryRun
      ? 'Simulacao (--dry-run): nada foi gravado.'
      : `Importacao concluida em ${seconds(report.durationMs)}.`,
    `Categorias  ${categories.created} criadas, ${categories.updated} atualizadas, ` +
      `${categories.failed} com falha`,
    `Produtos    ${products.created} criados, ${products.updated} atualizados, ` +
      `${products.failed} com falha`,
    `Variantes   ${variants.created} criadas, ${variants.deactivated} desativadas`,
    report.transactional
      ? 'Transacao   tudo dentro de uma so.'
      : 'Transacao   nao suportada por este cluster; gravado direto.',
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
