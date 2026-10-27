import { ROUTES } from '@/app/routes';
import { useAddToCart } from '@/components/store';
import { Badge, Button, ButtonLink, Container, Skeleton } from '@/components/ui';
import {
  compareAtCents,
  displayVariant,
  soleVariant,
  useProduct,
  useShelf,
  type PublicProductDetail,
} from '@/features/catalog';
import { bestInterestFreeInstallment, usePaymentSettings } from '@/features/payments';
import { imageProps, imageSrcSet } from '@/lib/cloudinary';
import { formatCents, formatCentsRange, formatInstallment } from '@/lib/format';
import { cx } from '@/lib/cx';
import styles from './featured-perfume.module.css';

/**
 * O perfume da vez: um produto só, grande, com o texto que a dona escreveu.
 *
 * ## Quem escolhe
 *
 * A dona, pelo painel. E o **primeiro produto marcado como destaque** — a
 * mesma marcação que alimenta a prateleira "Destaques" —, e isso e de
 * propósito: a loja já tem um lugar onde ela diz "este aqui", e criar um
 * segundo campo só para esta seção seria pedir que ela mantivesse duas
 * listas sincronizadas para sempre.
 *
 * Sem nenhum destaque marcado, a seção não existe. Ela não cai para "o mais
 * caro" nem para "o primeiro do catálogo": este bloco e uma recomendação da
 * casa, e uma recomendação escolhida por um critério automático não e uma
 * recomendação.
 *
 * ## Duas consultas, e por quê
 *
 * A prateleira devolve o produto no formato do card — sem descrição. O texto
 * que faz este bloco valer a pena (as notas, a fixação, para quem e) só vem
 * em `GET /products/:slug`. A segunda consulta usa exatamente a chave que a
 * página do produto vai pedir no clique, então ela não e desperdício: e a
 * prebusca da próxima tela.
 */
export function FeaturedPerfume() {
  const featured = useShelf('featured');
  const first = featured.data?.[0];
  const slug = first?.slug ?? '';

  const { data: product, isLoading } = useProduct(slug);

  if (featured.isError || (!featured.isLoading && first === undefined)) {
    return null;
  }

  if (featured.isLoading || isLoading || product === undefined) {
    return <FeaturedSkeleton />;
  }

  return <Featured product={product} />;
}

function Featured({ product }: { product: PublicProductDetail }) {
  const addToCart = useAddToCart();
  const { data: payment } = usePaymentSettings();

  const variant = displayVariant(product);
  const single = soleVariant(product);
  const compareAt = compareAtCents(product);
  const { min, max } = product.priceRangeCents;

  const installment = payment?.card ? bestInterestFreeInstallment(min, payment.card) : null;
  const srcSet = imageSrcSet(product.coverImage);

  return (
    <section className={styles.featured} aria-labelledby="perfume-da-vez">
      <Container>
        <h2 id="perfume-da-vez" className={styles.title}>
          O perfume da vez
        </h2>
      </Container>

      <Container className={styles.inner}>
        <div className={styles.media}>
          <picture>
            {srcSet ? <source srcSet={srcSet} sizes="(min-width: 64rem) 42vw, 92vw" /> : null}

            <img
              {...imageProps(product.coverImage, 'detail', '(min-width: 64rem) 42vw, 92vw')}
              alt=""
              className={styles.image}
              width={900}
              height={900}
              loading="lazy"
              decoding="async"
            />
          </picture>

          {/* Só o estado, como no cartão da vitrine. O desconto não vem para
              a foto: ele mora ao lado do preço, uma coluna adiante, que e
              onde ele esta em toda a loja. */}
          <div className={styles.badges}>
            {product.isReadyToShip ? <Badge variant="success">Pronta entrega</Badge> : null}
          </div>
        </div>

        <div className={styles.body}>
          {product.brand === '' ? null : (
            <p className={cx(styles.brand, 'meta-label')}>{product.brand}</p>
          )}

          {/*
            `<h3>` embaixo do `<h2>` da seção, e desenhado maior que ele.
            Nível e conteúdo, corpo e ênfase: a seção se chama "O perfume da
            vez" e o perfume e o que ela contem — mas quem chega aqui quer
            ler o nome do perfume, não o nome da seção.
          */}
          <h3 className={styles.name}>{product.name}</h3>

          {/* A marca sobe acima do nome porque e assim que o rótulo de um
              frasco se lê, e porque e um dado — não um enfeite anunciando o
              título. */}

          {product.description.trim() === '' ? null : (
            <p className={styles.description}>{excerpt(product.description)}</p>
          )}

          {/*
            A escada inteira, e não só o primeiro degrau.

            No card da fileira cabe um degrau; aqui cabem os três, e são eles
            que respondem "vale a pena levar mais de um?" — que e a pergunta
            que um bloco deste tamanho existe para responder.
          */}
          {product.quantityDiscounts.length > 0 ? (
            <ul className={styles.tiers}>
              {product.quantityDiscounts.map((tier) => (
                <li key={tier.minQty} className={styles.tier}>
                  <span className={styles.tierQty}>Leve {tier.minQty}</span>
                  <span className={styles.tierOff}>{tier.percentOff}% OFF</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className={styles.pricing}>
            {compareAt === null ? null : (
              <p className={`${styles.compareAt} tabular`}>
                <span className="visually-hidden">De </span>
                {formatCents(compareAt)}
              </p>
            )}

            <p className={styles.priceRow}>
              <span className={`${styles.price} tabular`}>
                {min === max ? null : <span className="visually-hidden">A partir de </span>}
                {formatCentsRange(product.priceRangeCents)}
              </span>

              {/* "até" na faixa de preço, pelo mesmo motivo do cartão: o
                  desconto e o da opção mais barata, não o das duas pontas. */}
              {product.discountPercent > 0 ? (
                <span className={styles.off}>
                  {min === max ? '' : 'até '}
                  {product.discountPercent}% OFF
                </span>
              ) : null}
            </p>

            {installment === null ? null : (
              <p className={styles.installment}>
                em até{' '}
                <span className="tabular">
                  {formatInstallment(installment.count, installment.installmentCents)}
                </span>{' '}
                sem juros
              </p>
            )}
          </div>

          <div className={styles.actions}>
            {single === null ? (
              <ButtonLink to={ROUTES.product(product.slug)} className={styles.buy}>
                Ver opções
              </ButtonLink>
            ) : (
              <Button
                className={styles.buy}
                disabled={!product.inStock || variant === null}
                onClick={() => {
                  addToCart(product, single);
                }}
              >
                {product.inStock ? 'Comprar' : 'Esgotado'}
              </Button>
            )}

            <ButtonLink to={ROUTES.product(product.slug)} variant="secondary">
              Ver o produto
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * O começo da descrição, em texto puro.
 *
 * A descrição e Markdown do painel. Aqui ela e um chamariz de duas ou três
 * linhas, não a ficha inteira — quem quer a ficha clica. Os marcadores são
 * removidos em vez de renderizados: um `##` no meio de um parágrafo de
 * vitrine viraria um título solto dentro do bloco.
 */
const EXCERPT_LIMIT = 260;

function excerpt(markdown: string): string {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= EXCERPT_LIMIT) {
    return plain;
  }

  // Corta na última palavra inteira: um corte no meio de "amadeirado" e mais
  // feio do que uma linha um pouco mais curta.
  const cut = plain.slice(0, EXCERPT_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * O lugar do bloco, enquanto as duas consultas não voltam.
 *
 * Reusa a mesma grade e as mesmas medidas, então quando o produto chega a
 * página ganha cor sem se mexer.
 */
function FeaturedSkeleton() {
  return (
    <section className={styles.featured} aria-busy="true">
      <Container className={styles.inner}>
        <div className={styles.media}>
          <Skeleton width="100%" height="100%" />
        </div>

        <div className={styles.body}>
          <Skeleton width="8rem" height="0.75rem" />
          <Skeleton width="70%" height="2rem" />
          <Skeleton width="100%" height="4.5rem" />
          <Skeleton width="10rem" height="2.25rem" />
          <Skeleton width="100%" height="var(--control-height)" />
        </div>
      </Container>
    </section>
  );
}
