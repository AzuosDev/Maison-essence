import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './empty-state.module.css';

/**
 * O vazio com explicacao: sacola sem itens, busca sem resultado, painel sem
 * pedidos do dia.
 *
 * Nunca e so "nada encontrado". Diz o que aconteceu e oferece a saida — e a
 * saida importa mais que o texto: uma busca sem resultado com um botao
 * "ver todos os perfumes" recupera a visita que um vazio mudo perderia.
 */
export type EmptyStateProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  title: string;
  description?: ReactNode;
  /** Um simbolo curto dentro do circulo de areia. */
  icon?: ReactNode;
  /** Um botao, ou dois. Nunca mais que isso. */
  actions?: ReactNode;
  /** Menos respiro: dentro de um card ou da gaveta da sacola. */
  compact?: boolean;
  /** O nivel do titulo no documento. */
  as?: 'h2' | 'h3' | 'p';
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { title, description, icon, actions, compact = false, as: Title = 'p', className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx(styles.empty, compact && styles.compact, className)} {...props}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}

      <Title className={styles.title}>{title}</Title>

      {description ? <p className={styles.description}>{description}</p> : null}

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
});
