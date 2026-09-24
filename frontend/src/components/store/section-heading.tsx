import { cx } from '@/lib/cx';
import styles from './section-heading.module.css';

/**
 * O cabeçalho de uma seção da loja.
 *
 * Filete dourado, título em serifada e uma linha de apoio opcional, tudo
 * centralizado — e o desenho que separa as prateleiras da home e que a
 * vitrine reaproveita.
 *
 * O nível do título e escolhido por quem usa, e isso não e preferência de
 * estilo: a home tem um `<h1>` só, no hero, e as prateleiras abaixo dele são
 * `<h2>`. Um componente que fixasse `<h2>` obrigaria a próxima tela que
 * precisar de `<h3>` a copia-lo inteiro.
 */
interface SectionHeadingProps {
  title: string;
  description?: string | undefined;
  as?: 'h2' | 'h3';
  /** O `id` do título, para o `aria-labelledby` da seção. */
  titleId?: string | undefined;
  className?: string | undefined;
}

export function SectionHeading({
  title,
  description,
  as: Tag = 'h2',
  titleId,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cx(styles.heading, className)}>
      <Tag id={titleId} className={styles.title}>
        {title}
      </Tag>

      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
