import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cx } from '@/lib/cx';
import styles from './brand-logo.module.css';

/**
 * A marca: monograma ME em moldura dourada sobre o nome em caixa alta.
 *
 * O `aria-label` carrega o nome inteiro e o monograma fica `aria-hidden`:
 * sem isso, um leitor de tela anuncia "M E Maison Essence" — o monograma e
 * as mesmas duas letras do nome, desenhadas.
 */
interface BrandLogoProps {
  /** Encolhido: em linha, com o monograma menor. */
  compact?: boolean;
  /** Sobre fundo escuro. */
  inverted?: boolean;
  /** Sem link: no rodape e na gaveta, onde a marca nao e um caminho. */
  asLink?: boolean;
  className?: string | undefined;
}

export function BrandLogo({
  compact = false,
  inverted = false,
  asLink = true,
  className,
}: BrandLogoProps) {
  const content = (
    <>
      <span className={styles.monogram} aria-hidden="true">
        ME
      </span>
      <span className={styles.wordmark}>Maison Essence</span>
    </>
  );

  const classes = cx(
    styles.logo,
    compact && styles.compact,
    inverted && styles.inverted,
    className,
  );

  if (!asLink) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link to={ROUTES.home} className={classes} aria-label="Maison Essence, pagina inicial">
      {content}
    </Link>
  );
}
