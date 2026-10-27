import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { useCategoryTree, type CategoryTree } from '@/features/catalog';
import { imageProps, imageSrcSet } from '@/lib/cloudinary';
import styles from './collection-posters.module.css';

/**
 * Os dois cartazes de coleção, entre duas prateleiras.
 *
 * ## O que eles são, e o que não são
 *
 * Na loja que serviu de referência, este lugar e ocupado por duas artes
 * promocionais — banners desenhados a mão para uma campanha. A Maison
 * Essence tem um lugar para arte assim, e e o carrossel do topo, que a dona
 * controla pelo painel com agendamento.
 *
 * Aqui estão **coleções de verdade**: duas categorias do catálogo, com a
 * foto que a dona cadastrou e a contagem de produtos que a API devolve.
 * Nenhuma promessa inventada, nenhuma arte fabricada — e, ao contrário de um
 * banner, elas nunca ficam desatualizadas, porque saem do próprio catálogo.
 *
 * ## Quais duas
 *
 * As duas maiores **que tem foto**. Sem foto o cartaz vira um retângulo
 * cinza com um nome em cima, e dois retângulos cinzas no meio da vitrine são
 * piores do que não ter a seção: a faixa some inteira nesse caso.
 */
export function CollectionPosters() {
  const { data } = useCategoryTree();

  const posters = (data ?? [])
    .filter((category) => category.image !== '' && category.productCount > 0)
    .toSorted((a, b) => b.productCount - a.productCount)
    .slice(0, 2);

  // Uma categoria só não e um par: o desenho desta faixa são duas colunas, e
  // uma coluna sozinha com 680px de largura vira um banner que ninguém
  // pediu.
  if (posters.length < 2) {
    return null;
  }

  return (
    <section className={styles.posters} aria-label="Coleções">
      <Container className={styles.grid}>
        {posters.map((category) => (
          <Poster key={category.id} category={category} />
        ))}
      </Container>
    </section>
  );
}

function Poster({ category }: { category: CategoryTree }) {
  const srcSet = imageSrcSet(category.image);

  return (
    <Link to={ROUTES.category(category.slug)} className={styles.poster}>
      <picture>
        {srcSet ? <source srcSet={srcSet} sizes="(min-width: 64rem) 46vw, 92vw" /> : null}

        <img
          {...imageProps(category.image, 'detail', '(min-width: 64rem) 46vw, 92vw')}
          alt=""
          className={styles.image}
          width={1200}
          height={750}
          loading="lazy"
          decoding="async"
        />
      </picture>

      {/* O véu escurece só o pe do cartaz, que e onde o texto cai: escurecer
          a foto inteira apagaria o produto que ela mostra. */}
      <span className={styles.scrim} aria-hidden="true" />

      <span className={styles.caption}>
        <span className={styles.name}>{category.name}</span>

        <span className={styles.count}>
          {category.productCount} {category.productCount === 1 ? 'produto' : 'produtos'}
        </span>

        {/* Não e um link dentro de um link: o cartaz inteiro já e o link, e
            isto e o desenho do convite. */}
        <span className={styles.action}>Ver a coleção</span>
      </span>
    </Link>
  );
}
