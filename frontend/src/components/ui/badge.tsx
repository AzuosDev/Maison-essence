import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import styles from './badge.module.css';

/**
 * O selo: `Esgotado`, `-33%`, `Pronta entrega`.
 *
 * A cor nunca e o unico portador do recado — cada selo tem texto, e o texto
 * diz o que a cor sugere. Quem nao distingue verde de vermelho le "esgotado"
 * do mesmo jeito.
 */

export type BadgeVariant = 'ink' | 'success' | 'danger' | 'gold' | 'muted';

export type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  variant?: BadgeVariant;
  /** Numero em largura fixa: contagem que aparece em coluna de tabela. */
  numeric?: boolean;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'ink', numeric = false, className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx(styles.badge, styles[variant], numeric && styles.numeric, className)}
      {...props}
    />
  );
});
