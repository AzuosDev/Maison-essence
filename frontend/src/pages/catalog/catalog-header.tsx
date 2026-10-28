import { Breadcrumb, Skeleton, type BreadcrumbItem } from '@/components/ui';
import styles from './catalog-header.module.css';

/**
 * O cabeçalho da listagem: onde você esta, o que esta vendo e quantos são.
 *
 * ## A contagem
 *
 * Fica numa linha de altura reservada, e não aparece do nada quando a
 * consulta responde. Sem a reserva, a chegada do número empurraria a grade
 * inteira para baixo alguns pixels — que e exatamente o salto de layout que
 * o critério de aceite proibe, só que no lugar onde ninguém procura.
 *
 * Enquanto carrega, a linha mostra um tracinho em vez de "0 produtos": zero
 * e uma informação, e anuncia-lá antes de saber seria mentir por um
 * instante — bastante para o cliente achar que a categoria esta vazia.
 */

export interface CatalogHeaderProps {
  breadcrumb: readonly BreadcrumbItem[];
  title: string;
  description?: string | undefined;
  /** `undefined` enquanto a consulta não respondeu. */
  totalItems: number | undefined;
  isLoading: boolean;
  /** O título ainda não chegou — o nome da categoria vem de outra consulta. */
  isTitleLoading?: boolean;
  /**
   * A contagem foi para a barra de ordenação.
   *
   * E o que acontece no desktop: ali a barra tem o seletor de ordem numa
   * ponta e nada na outra, e a contagem e exatamente o que faltava daquele
   * lado. No celular a barra já carrega o botão de filtros, e a contagem
   * fica onde nasceu — embaixo do título.
   */
  hideCount?: boolean;
}

/** `1 produto`, `24 produtos`, `Nenhum produto`. */
export function countLabel(total: number): string {
  if (total === 0) {
    return 'Nenhum produto';
  }

  return total === 1 ? '1 produto' : `${total} produtos`;
}

export function CatalogHeader({
  breadcrumb,
  title,
  description,
  totalItems,
  isLoading,
  isTitleLoading = false,
  hideCount = false,
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

      {hideCount ? null : (
        <p className={styles.count} aria-live="polite">
          {isLoading || totalItems === undefined ? (
            <span aria-hidden="true">—</span>
          ) : (
            countLabel(totalItems)
          )}
        </p>
      )}
    </header>
  );
}
