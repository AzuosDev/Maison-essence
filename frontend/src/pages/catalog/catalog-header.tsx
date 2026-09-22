import { Breadcrumb, Skeleton, type BreadcrumbItem } from '@/components/ui';
import styles from './catalog-header.module.css';

/**
 * O cabecalho da listagem: onde voce esta, o que esta vendo e quantos sao.
 *
 * ## A contagem
 *
 * Fica numa linha de altura reservada, e nao aparece do nada quando a
 * consulta responde. Sem a reserva, a chegada do numero empurraria a grade
 * inteira para baixo alguns pixels — que e exatamente o salto de layout que
 * o criterio de aceite proibe, so que no lugar onde ninguem procura.
 *
 * Enquanto carrega, a linha mostra um tracinho em vez de "0 produtos": zero
 * e uma informacao, e anuncia-la antes de saber seria mentir por um
 * instante — bastante para o cliente achar que a categoria esta vazia.
 */

export interface CatalogHeaderProps {
  breadcrumb: readonly BreadcrumbItem[];
  title: string;
  description?: string | undefined;
  /** `undefined` enquanto a consulta nao respondeu. */
  totalItems: number | undefined;
  isLoading: boolean;
  /** O titulo ainda nao chegou — o nome da categoria vem de outra consulta. */
  isTitleLoading?: boolean;
}

export function CatalogHeader({
  breadcrumb,
  title,
  description,
  totalItems,
  isLoading,
  isTitleLoading = false,
}: CatalogHeaderProps) {
  return (
    <header className={styles.header}>
      <Breadcrumb items={breadcrumb} className={styles.crumbs} />

      <h1 className={styles.title}>
        {isTitleLoading ? <Skeleton width="12ch" height="0.8em" /> : title}
      </h1>

      {description === undefined || description === '' ? null : (
        <p className={styles.description}>{description}</p>
      )}

      <p className={styles.count} aria-live="polite">
        {isLoading || totalItems === undefined ? (
          <span aria-hidden="true">—</span>
        ) : (
          countLabel(totalItems)
        )}
      </p>
    </header>
  );
}

/** `1 produto`, `24 produtos`, `Nenhum produto`. */
function countLabel(total: number): string {
  if (total === 0) {
    return 'Nenhum produto';
  }

  return total === 1 ? '1 produto' : `${total} produtos`;
}
