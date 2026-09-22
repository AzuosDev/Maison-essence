import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { SectionHeading } from '@/components/store';
import { Container, Skeleton } from '@/components/ui';
import { useCategoryTree, type CategoryTree } from '@/features/catalog';
import { imageProps } from '@/lib/cloudinary';
import styles from './category-strip.module.css';

/**
 * A faixa de categorias principais.
 *
 * "Principais" sao as raizes da arvore — as que a dona cadastrou no primeiro
 * nivel. As subcategorias ficam no menu do cabecalho e na pagina da
 * categoria; aqui elas so espremeriam os cards.
 *
 * O corte em seis e de layout, nao de negocio: na grade do desktop, a partir
 * do setimo card a foto fica menor que a miniatura do carrinho. A loja que
 * crescer para oito categorias mostra as seis primeiras aqui e todas no
 * menu — que e onde quem procura uma categoria especifica vai olhar.
 */
const MAX_CATEGORIES = 6;

export function CategoryStrip() {
  const titleId = useId();
  const { data, isLoading, isError } = useCategoryTree();
  const categories = (data ?? []).slice(0, MAX_CATEGORIES);

  if (isError || (!isLoading && categories.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} aria-busy={isLoading || undefined} className={styles.strip}>
      <Container>
        <SectionHeading
          title="Navegue por categoria"
          description="Cada familia olfativa em um lugar so."
          titleId={titleId}
        />

        <ul className={styles.list}>
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <li key={index} className={styles.item}>
                  <Skeleton className={styles.card} />
                </li>
              ))
            : categories.map((category) => (
                <li key={category.id} className={styles.item}>
                  <CategoryCard category={category} />
                </li>
              ))}
        </ul>
      </Container>
    </section>
  );
}

/**
 * O card de uma categoria.
 *
 * O `alt` da foto fica vazio: o nome da categoria esta no proprio link, logo
 * abaixo. Um `alt` com "Masculino" faria o leitor de tela anunciar "Masculino
 * Masculino" — a foto e ilustracao do link, nao informacao a parte.
 */
function CategoryCard({ category }: { category: CategoryTree }) {
  return (
    <Link to={ROUTES.category(category.slug)} className={styles.card}>
      <img
        {...imageProps(category.image, 'card', '(min-width: 64rem) 16vw, 42vw')}
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
        <br />
        <span className={styles.count}>
          {category.productCount} {category.productCount === 1 ? 'produto' : 'produtos'}
        </span>
      </span>
    </Link>
  );
}
