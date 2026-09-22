import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/lib/cx';
import styles from './chip.module.css';

/**
 * A pilula de categoria.
 *
 * Duas formas, pelo mesmo motivo do botao: `Chip` e um `<button>`, para
 * filtro que muda o estado da tela; `ChipLink` e um `<a>`, para categoria
 * que e um endereco proprio — e a categoria da loja e um endereco proprio,
 * porque precisa poder ser compartilhada e indexada.
 *
 * O estado escolhido vai em `aria-pressed` (botao) ou `aria-current` (link),
 * e nao so na cor: para quem usa leitor de tela, "Masculino, pressionado" e
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
