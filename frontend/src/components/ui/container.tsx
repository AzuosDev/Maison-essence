import type { ElementType, ReactNode } from 'react';
import styles from './container.module.css';

/**
 * A caixa que segura o conteudo na largura da marca.
 *
 * Existe como componente, e nao como classe utilitaria copiada em cada
 * secao, porque a largura maxima e o gutter sao decisao de layout e mudam
 * juntos. E `as` permite que a semantica acompanhe: a mesma medida serve a um
 * `<header>`, a um `<main>` e a uma `<section>`.
 */
interface ContainerProps {
  as?: ElementType;
  /** Sem limite de largura: faixa que encosta nas bordas da janela. */
  flush?: boolean;
  /**
   * O `| undefined` e explicito porque `exactOptionalPropertyTypes` esta
   * ligado: sem ele, passar uma classe de CSS Module — que o TypeScript ve
   * como `string | undefined` — nao compilaria.
   */
  className?: string | undefined;
  children: ReactNode;
}

export function Container({ as: Tag = 'div', flush = false, className, children }: ContainerProps) {
  const classes = [styles.container, flush ? styles.flush : null, className]
    .filter(Boolean)
    .join(' ');

  return <Tag className={classes}>{children}</Tag>;
}
