import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/lib/cx';
import styles from './chip.module.css';

/**
 * A pílula de categoria.
 *
 * Duas formas, pelo mesmo motivo do botão: `Chip` e um `<button>`, para
 * filtro que muda o estado da tela; `ChipLink` e um `<a>`, para categoria
 * que e um endereço próprio — e a categoria da loja e um endereço próprio,
 * porque precisa poder ser compartilhada e indexada.
 *
 * O estado escolhido vai em `aria-pressed` (botão) ou `aria-current` (link),
 * e não só na cor: para quem usa leitor de tela, "Masculino, pressionado" e
 * o que diz que o filtro esta valendo.
 */

interface ChipStyleProps {
  /** Escolhido: fundo `--ink`, texto creme. */
  active?: boolean;
  /** A contagem ao lado do nome: `Masculino 24`. */
  count?: number;
}

export type ChipProps = ChipStyleProps & ComponentPropsWithoutRef<'button'>;

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, count, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cx(styles.chip, active && styles.active, className)}
      {...props}
    >
      {children}
      {renderCount(count)}
    </button>
  );
});

export type ChipLinkProps = ChipStyleProps & LinkProps;

export const ChipLink = forwardRef<HTMLAnchorElement, ChipLinkProps>(function ChipLink(
  { active = false, count, className, children, ...props },
  ref,
) {
  return (
    <Link
      ref={ref}
      aria-current={active ? 'page' : undefined}
      className={cx(styles.chip, active && styles.active, className)}
      {...props}
    >
      {children}
      {renderCount(count)}
    </Link>
  );
});

function renderCount(count: number | undefined): ReactNode {
  return count === undefined ? null : <span className={styles.count}>{count}</span>;
}
