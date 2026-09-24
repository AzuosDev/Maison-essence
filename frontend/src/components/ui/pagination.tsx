import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import styles from './pagination.module.css';

/**
 * A paginação da vitrine e das tabelas do painel.
 *
 * A página atual vai em `aria-current="page"`, e cada número tem um rótulo
 * completo ("Página 3") para o leitor de tela: um botão que só contem "3"
 * não diz nada fora do contexto visual.
 *
 * No celular os números somem e ficam as setas com "3 de 12". Não e só
 * espaço: doze alvos de toque lado a lado ficam menores que o dedo, e errar
 * a página e mais caro que um toque a mais.
 */

/** Quantas páginas aparecem em volta da atual antes de virar reticências. */
const WINDOW = 1;

export type PaginationProps = Omit<ComponentPropsWithoutRef<'nav'>, 'onChange'> & {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
};

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { page, totalPages, onPageChange, label = 'Paginação', className, ...props },
  ref,
) {
  // Uma página só não e paginação.
  if (totalPages <= 1) {
    return null;
  }

  const go = (next: number): void => {
    const clamped = Math.min(Math.max(next, 1), totalPages);

    if (clamped !== page) {
      onPageChange(clamped);
    }
  };

  return (
    <nav ref={ref} aria-label={label} className={cx(styles.nav, className)} {...props}>
      <button
        type="button"
        onClick={() => {
          go(page - 1);
        }}
        disabled={page <= 1}
        className={styles.arrow}
        aria-label="Página anterior"
      >
        <span className={cx(styles.chevron, styles.chevronPrev)} aria-hidden="true" />
      </button>

      <ol className={styles.pages}>
        {pagesFor(page, totalPages).map((item, index, all) =>
          item === null ? (
            // A chave sai da página anterior, e não do índice: as duas
            // reticências possíveis são "depois da 1" e "depois da 7", e
            // isso não muda quando a lista encolhe.
            <li key={`gap-${String(all[index - 1])}`} className={styles.gap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => {
                  go(item);
                }}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Página ${item}`}
                className={cx(styles.page, item === page && styles.active)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ol>

      {/* O mesmo conteudo dos numeros, em uma frase, para o celular. */}
      <p className={styles.summary} aria-hidden="true">
        {page} de {totalPages}
      </p>

      <button
        type="button"
        onClick={() => {
          go(page + 1);
        }}
        disabled={page >= totalPages}
        className={styles.arrow}
        aria-label="Próxima página"
      >
        <span className={cx(styles.chevron, styles.chevronNext)} aria-hidden="true" />
      </button>
    </nav>
  );
});

/**
 * As páginas que aparecem; `null` e uma faixa de reticências.
 *
 * Sempre a primeira, a última e as vizinhas da atual. `1 … 5 6 7 … 12`.
 */
function pagesFor(page: number, totalPages: number): (number | null)[] {
  const visible = new Set<number>([1, totalPages]);

  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const candidate = page + offset;

    if (candidate >= 1 && candidate <= totalPages) {
      visible.add(candidate);
    }
  }

  const sorted = [...visible].toSorted((a, b) => a - b);
  const result: (number | null)[] = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];

    // Buraco de uma página só não vira reticências: o número ocupa o mesmo
    // espaço e diz mais.
    if (previous !== undefined && value - previous > 1) {
      result.push(value - previous === 2 ? value - 1 : null);
    }

    result.push(value);
  }

  return result;
}
