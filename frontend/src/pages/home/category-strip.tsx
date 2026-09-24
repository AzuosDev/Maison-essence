import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { SectionHeading } from '@/components/store';
import { Container, Skeleton } from '@/components/ui';
import { useCategoryTree, type CategoryTree } from '@/features/catalog';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import styles from './category-strip.module.css';

/**
 * Quatro, e não seis.
 *
 * A faixa mostrava seis categorias numa fileira que rolava, com fichas de
 * 10rem. Em cartaz de 4/5 com o nome sobre a foto, quatro e o que cabe numa
 * linha de desktop sem espremer — e cinco ou seis obrigariam a fileira a
 * rolar de novo, que e o que a prateleira de produtos logo abaixo já faz.
 * Duas faixas que rolam, uma em cima da outra, competem pelo mesmo gesto.
 *
 * As categorias que sobram não somem: o menu do cabeçalho e o painel de
 * categorias trazem a árvore inteira.
 */
const MAX_CATEGORIES = 4;

interface CategoryStripProps {
  /** Sem respiro em cima: a faixa encosta no que vem antes dela. */
  flush?: boolean;
}

export function CategoryStrip({ flush = false }: CategoryStripProps) {
  const titleId = useId();
  const { data, isLoading, isError } = useCategoryTree();

  const categories = (data ?? []).slice(0, MAX_CATEGORIES);

  if (isError || (!isLoading && categories.length === 0)) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      className={cx(styles.strip, flush && styles.flush)}
    >
      <Container>
        <SectionHeading
          title="Descubra as coleções"
          description="Cada família olfativa em um lugar só."
          titleId={titleId}
        />

        <ul className={styles.list}>
          {isLoading
            ? Array.from({ length: MAX_CATEGORIES }, (_, index) => (
                <li key={index}>
                  <Skeleton className={styles.card} />
                </li>
              ))
            : categories.map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} />
                </li>
              ))}
        </ul>
      </Container>
    </section>
  );
}

function CategoryCard({ category }: { category: CategoryTree }) {
  return (
    <Link to={ROUTES.category(category.slug)} className={styles.card}>
      <img
        {...imageProps(category.image, 'card', '(min-width: 48rem) 24vw, 46vw')}
        alt=""
        className={styles.image}
        width={600}
        height={750}
        loading="lazy"
        decoding="async"
      />

      <span className={styles.scrim} aria-hidden="true" />

      <span className={styles.label}>
        <span className={styles.name}>{category.name}</span>
        <span className={styles.count}>
          {category.productCount} {category.productCount === 1 ? 'produto' : 'produtos'}
        </span>
      </span>

      {/* Não e um link: o cartaz inteiro já e. Ver a explicação no CSS. */}
      <span className={styles.action}>Ver</span>
    </Link>
  );
}
