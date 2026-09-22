import { forwardRef, Fragment, type ComponentPropsWithoutRef } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/cx';
import styles from './breadcrumb.module.css';

/**
 * O fio de pao: Inicio / Masculino / Asad Lattafa.
 *
 * Dentro de um `<nav>` com rotulo e de uma `<ol>`, porque e uma lista
 * ordenada de verdade — a ordem e a informacao. O ultimo item nao e link e
 * leva `aria-current="page"`: linkar a pagina em que se esta e um clique que
 * nao leva a lugar nenhum.
 */

export interface BreadcrumbItem {
  label: string;
  /** Sem `to`, o item e texto. O ultimo sempre e. */
  to?: string;
}

export type BreadcrumbProps = ComponentPropsWithoutRef<'nav'> & {
  items: readonly BreadcrumbItem[];
  /** O rotulo do `<nav>`, para quem navega por marcos. */
  label?: string;
};

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { items, label = 'Voce esta aqui', className, ...props },
  ref,
) {
  return (
    <nav ref={ref} aria-label={label} className={cx(styles.nav, className)} {...props}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <Fragment key={item.label}>
              <li className={styles.item}>
                {item.to && !last ? (
                  <Link to={item.to} className={styles.link}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={styles.current} aria-current={last ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>

              {last ? null : (
                <li className={styles.separator} aria-hidden="true">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
});
