import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
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
 * Aqui esta o **destaque do meio da página**: duas portas largas, com arte
 * própria, para onde a loja quer levar quem já rolou além da primeira tela.
 *
 * ## De onde sai a lista, e por que ela deixou de ser o catálogo
 *
 * Da faixa que a dona monta no painel: nome, arte e destino de cada cartaz.
 * Ate aqui estes dois eram, literalmente, as duas categorias-raiz com mais
 * produtos que tivessem foto — ninguém escolhia, o catálogo escolhia. Isso
 * tinha duas consequências que ninguém pediu: a faixa trocava sozinha quando
 * o catálogo crescia, e destacar "Victoria's Secret", que e marca, ou "Mais
 * vendidos", que não e categoria nenhuma, exigia inventar uma categoria
 * vazia e reclassificar produto.
 *
 * E a mesma amarra que a fileira de círculos desfez, e a saída e a mesma:
 * lista própria. Ver `ShortcutCircles` — e, no backend, `CollectionPoster`.
 *
 * **Sem nenhum cartaz cadastrado a faixa volta a deduzir as duas
 * categorias**, que e o que ela sempre fez. Não e tolerância a configuração
 * pela metade: e o que faz esta troca não apagar a faixa de nenhuma loja no
 * dia do deploy.
 *
 * ## Dois, e paisagem
 *
 * Dois porque o desenho são duas colunas: um cartaz sozinho com 1232px de
 * largura vira um banner que ninguém pediu, e a faixa some inteira nesse
 * caso. A arte e 16:9 por contrato — a moldura tem essa proporção fixa e
 * `object-fit: cover` corta o que sobrar pelo centro.
 */
export function CollectionPosters() {
  const { settings } = useStoreSettings();
  const { data: categories } = useCategoryTree();

  const posters = settings?.posters ?? [];

  /*
   * A arvore e pedida sempre, e não só quando a faixa esta vazia — mesma
   * razão da fileira de círculos: a consulta já sai uma vez para esta
   * página, e as duas seções leem a mesma resposta do cache.
   */
  const cards: Card[] =
    posters.length > 0
      ? posters.map((poster) => ({
          key: poster.id,
          label: poster.label,
          image: poster.image,
          caption: poster.caption,
          to: poster.link,
        }))
      : (categories ?? [])
          .filter((category) => category.image !== '' && category.productCount > 0)
          .toSorted((a, b) => b.productCount - a.productCount)
          .slice(0, 2)
          .map((category) => ({
            key: category.id,
            label: category.name,
            image: category.image,
            caption: `${category.productCount} ${category.productCount === 1 ? 'produto' : 'produtos'}`,
            to: ROUTES.category(category.slug),
          }));

  // Um cartaz só não e um par: o desenho desta faixa são duas colunas, e uma
  // coluna sozinha com 1232px de largura vira um banner que ninguém pediu.
  if (cards.length < 2) {
    return null;
  }

  return (
    <section className={styles.posters} aria-label="Coleções">
      <Container className={styles.grid}>
        {cards.map((card) => (
          <Poster key={card.key} card={card} />
        ))}
      </Container>
    </section>
  );
}

/** Um cartaz da faixa, venha ele da lista da dona ou do catálogo. */
interface Card {
  key: string;
  label: string;
  /** `publicId` do Cloudinary. Nunca vazio: a faixa não desenha cartaz sem arte. */
  image: string;
  /** A linha de apoio. Vazia some, em vez de abrir um vão embaixo do nome. */
  caption: string;
  to: string;
}

function Poster({ card }: { card: Card }) {
  const srcSet = imageSrcSet(card.image);

  return (
    <Link to={card.to} className={styles.poster}>
      <picture>
        {srcSet ? <source srcSet={srcSet} sizes="(min-width: 64rem) 46vw, 92vw" /> : null}

        <img
          {...imageProps(card.image, 'detail', '(min-width: 64rem) 46vw, 92vw')}
          alt=""
          className={styles.image}
          width={1200}
          height={675}
          loading="lazy"
          decoding="async"
        />
      </picture>

      {/* O véu escurece só o pe do cartaz, que e onde o texto cai: escurecer
          a foto inteira apagaria o produto que ela mostra. */}
      <span className={styles.scrim} aria-hidden="true" />

      <span className={styles.caption}>
        <span className={styles.name}>{card.label}</span>

        {card.caption === '' ? null : <span className={styles.count}>{card.caption}</span>}

        {/* Não e um link dentro de um link: o cartaz inteiro já e o link, e
            isto e o desenho do convite. */}
        <span className={styles.action}>Ver a coleção</span>
      </span>
    </Link>
  );
}
