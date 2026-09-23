export type ItemStatus =
  | 'matched-exact'
  | 'matched-approximate'
  | 'unmatched'
  | 'discarded-small'
  | 'discarded-cover'
  | 'discarded-duplicate'
  | 'discarded-duplicate-slug';

export interface ExtractedItem {
  pdfFile: string;
  pageNumber: number;
  rawText: string;
  status: ItemStatus;
  matchedSlug: string | null;
  matchedName: string | null;
  score: number | null;
  /** Caminho do thumbnail, relativo a pasta `output/`, para a galeria de conferencia. */
  thumbnailPath: string;
}

export interface ExtractReport {
  totalCandidates: number;
  matchedExact: number;
  matchedApproximate: number;
  discardedSmall: number;
  discardedCover: number;
  discardedDuplicateImage: number;
  discardedDuplicateSlug: number;
  unmatched: number;
  productsWithoutImage: { slug: string; name: string }[];
  items: ExtractedItem[];
}

export function emptyReport(): ExtractReport {
  return {
    totalCandidates: 0,
    matchedExact: 0,
    matchedApproximate: 0,
    discardedSmall: 0,
    discardedCover: 0,
    discardedDuplicateImage: 0,
    discardedDuplicateSlug: 0,
    unmatched: 0,
    productsWithoutImage: [],
    items: [],
  };
}

export function recordItem(report: ExtractReport, item: ExtractedItem): void {
  report.items.push(item);
  report.totalCandidates += 1;

  switch (item.status) {
    case 'matched-exact':
      report.matchedExact += 1;
      break;
    case 'matched-approximate':
      report.matchedApproximate += 1;
      break;
    case 'discarded-small':
      report.discardedSmall += 1;
      break;
    case 'discarded-cover':
      report.discardedCover += 1;
      break;
    case 'discarded-duplicate':
      report.discardedDuplicateImage += 1;
      break;
    case 'discarded-duplicate-slug':
      report.discardedDuplicateSlug += 1;
      break;
    case 'unmatched':
      report.unmatched += 1;
      break;
  }
}

export function formatReport(report: ExtractReport): string[] {
  const lines: string[] = [];

  lines.push(`Imagens candidatas extraidas: ${report.totalCandidates}`);
  lines.push(`  casadas exatas         ${report.matchedExact}`);
  lines.push(`  casadas por aproximacao ${report.matchedApproximate}`);
  lines.push(`  sem correspondencia     ${report.unmatched}`);
  lines.push(`  descartadas (pequenas)  ${report.discardedSmall}`);
  lines.push(`  descartadas (capa/fundo) ${report.discardedCover}`);
  lines.push(`  descartadas (duplicadas) ${report.discardedDuplicateImage}`);

  if (report.discardedDuplicateSlug > 0) {
    lines.push(`  ignoradas (slug repetido) ${report.discardedDuplicateSlug}`);
  }

  lines.push('');
  lines.push(`Produtos sem foto: ${report.productsWithoutImage.length}`);

  if (report.matchedApproximate > 0) {
    lines.push('');
    lines.push(`Casamentos aproximados (conferir no ${'review.html'}):`);

    for (const item of report.items) {
      if (item.status === 'matched-approximate') {
        lines.push(
          `  "${item.rawText}" -> ${item.matchedSlug} (${Math.round((item.score ?? 0) * 100)}%, ${item.pdfFile} p.${item.pageNumber})`,
        );
      }
    }
  }

  return lines;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  'matched-exact': 'casado (exato)',
  'matched-approximate': 'casado (aproximado)',
  unmatched: 'sem correspondencia',
  'discarded-small': 'descartada: pequena demais',
  'discarded-cover': 'descartada: capa/fundo de pagina',
  'discarded-duplicate': 'descartada: duplicada',
  'discarded-duplicate-slug': 'ignorada: produto ja tinha foto nesta rodada',
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  'matched-exact': 'ok',
  'matched-approximate': 'warn',
  unmatched: 'bad',
  'discarded-small': 'muted',
  'discarded-cover': 'muted',
  'discarded-duplicate': 'muted',
  'discarded-duplicate-slug': 'muted',
};

/**
 * A galeria de conferencia (item 10 do pedido).
 *
 * Mostra TODA imagem candidata — casada, aproximada, sem correspondencia ou
 * descartada — lado a lado com o nome que o script leu na pagina e o produto
 * que ele escolheu. E deliberadamente sem JavaScript: um arquivo estatico que
 * abre em qualquer navegador com duplo clique, sem servidor.
 */
export function buildReviewHtml(report: ExtractReport): string {
  const rows = report.items
    .map((item, index) => {
      const badge = `<span class="badge ${STATUS_CLASS[item.status]}">${escapeHtml(STATUS_LABEL[item.status])}</span>`;
      const match =
        item.matchedSlug !== null
          ? `<div class="match">${escapeHtml(item.matchedName ?? '')}<br><code>${escapeHtml(item.matchedSlug)}</code>${
              item.score !== null ? ` <span class="score">${Math.round(item.score * 100)}%</span>` : ''
            }</div>`
          : '<div class="match muted">(nenhum produto)</div>';

      return `
      <figure data-index="${index}">
        <img src="${escapeHtml(item.thumbnailPath)}" loading="lazy" alt="${escapeHtml(item.rawText)}" />
        <figcaption>
          ${badge}
          <div class="raw">"${escapeHtml(item.rawText || '(sem texto)')}"</div>
          ${match}
          <div class="source">${escapeHtml(item.pdfFile)} — pagina ${item.pageNumber}</div>
        </figcaption>
      </figure>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Conferencia de imagens do catalogo</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f7f7f8; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.summary { color: #555; margin: 0 0 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  figure { background: #fff; border: 1px solid #e2e2e5; border-radius: 8px; margin: 0; overflow: hidden; }
  figure img { width: 100%; aspect-ratio: 3 / 4; object-fit: contain; background: #fafafa; display: block; }
  figcaption { padding: 10px 12px; font-size: 13px; line-height: 1.4; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; margin-bottom: 6px; }
  .badge.ok { background: #dcfce7; color: #166534; }
  .badge.warn { background: #fef9c3; color: #854d0e; }
  .badge.bad { background: #fee2e2; color: #991b1b; }
  .badge.muted { background: #eee; color: #666; }
  .raw { font-weight: 600; margin-bottom: 4px; }
  .match { margin-bottom: 4px; }
  .match code { font-size: 11px; color: #555; }
  .score { color: #854d0e; font-size: 11px; }
  .muted { color: #999; }
  .source { color: #888; font-size: 11px; }
  .filters { margin-bottom: 16px; }
  .filters button { font: inherit; font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid #ccc; background: #fff; cursor: pointer; margin-right: 6px; }
  .filters button.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
</style>
</head>
<body>
  <h1>Conferencia de imagens do catalogo</h1>
  <p class="summary">${report.totalCandidates} imagens candidatas — ${report.matchedExact} casadas, ${report.matchedApproximate} aproximadas, ${report.unmatched} sem produto, ${report.discardedSmall + report.discardedCover + report.discardedDuplicateImage} descartadas.</p>
  <div class="filters">
    <button data-filter="" class="active">Todas</button>
    <button data-filter="ok">Casadas</button>
    <button data-filter="warn">Aproximadas</button>
    <button data-filter="bad">Sem produto</button>
    <button data-filter="muted">Descartadas</button>
  </div>
  <div class="grid" id="grid">
${rows}
  </div>
  <script>
    // Filtro simples por classe do selo; sem isso a pagina so lista, o que
    // ja cumpre o pedido — o filtro e so para nao rolar 800 fotos a esmo.
    var buttons = document.querySelectorAll('.filters button');
    var figures = document.querySelectorAll('#grid figure');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        button.classList.add('active');
        var filter = button.getAttribute('data-filter');
        figures.forEach(function (figure) {
          var badge = figure.querySelector('.badge');
          var show = filter === '' || (badge && badge.classList.contains(filter));
          figure.style.display = show ? '' : 'none';
        });
      });
    });
  </script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
