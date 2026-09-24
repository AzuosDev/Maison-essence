import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './empty-state.module.css';

/**
 * O vazio com explicação: sacola sem itens, busca sem resultado, painel sem
 * pedidos do dia.
 *
 * Nunca e só "nada encontrado". Diz o que aconteceu e oferece a saída — e a
 * saída importa mais que o texto: uma busca sem resultado com um botão
 * "ver todos os perfumes" recupera a visita que um vazio mudo perderia.
 */
export type EmptyStateProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  title: string;
  description?: ReactNode;
  /** Um símbolo curto dentro do círculo de areia. */
  icon?: ReactNode;
  /** Um botão, ou dois. Nunca mais que isso. */
  actions?: ReactNode;
  /** Menos respiro: dentro de um card ou da gaveta da sacola. */
  compact?: boolean;
  /**
   * O nível do título no documento.
   *
   * `h1` existe para o vazio que **e** a tela: um pedido que não abriu, uma
   * página que não existe. Nesses casos o estado vazio ocupa o lugar do
   * conteúdo inteiro, e um documento sem `h1` deixa quem navega por títulos
   * sem ponto de partida.
   */
  as?: 'h1' | 'h2' | 'h3' | 'p';
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
