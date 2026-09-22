import { useId } from 'react';
import { ButtonLink, Container } from '@/components/ui';
import type { PublicProduct } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-card-skeleton';
import { SectionHeading } from './section-heading';
import styles from './product-shelf.module.css';

/**
 * Uma prateleira de produtos: destaques, pronta entrega, mais vendidos,
 * relacionados.
 *
 * Nao busca nada. Recebe a lista e os dois estados que mudam o desenho —
 * carregando e deu erro — porque as quatro prateleiras consomem rotas
 * diferentes e cada tela ja sabe qual e a sua. O componente cuida do que e
 * igual nas quatro: a grade, o cabecalho e o numero de esqueletos.
 *
 * ## Quando a prateleira nao aparece
 *
 * Lista vazia e erro somem da pagina, em vez de virarem uma caixa dizendo
 * "nenhum produto". Prateleira e sugestao: uma home com "Mais vendidos —
 * nenhum produto encontrado" nao informa nada ao cliente e ainda anuncia
 * que a loja esta vazia. O erro fica no console e no monitoramento, que sao
 * os lugares onde alguem pode agir sobre ele.
 */
interface ProductShelfProps {
  title: string;
  description?: string | undefined;
  /** `undefined` enquanto a consulta nao respondeu. */
  products: PublicProduct[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  /** O endereco do "ver todos". Sem ele, o rodape da prateleira nao aparece. */
  to?: string | undefined;
  linkLabel?: string;
  /** Quantos esqueletos desenhar. O padrao enche duas linhas no desktop. */
  skeletonCount?: number;
  /** Fundo areia, para separar de uma prateleira vizinha. */
  tinted?: boolean;
  className?: string | undefined;
}

const DEFAULT_SKELETON_COUNT = 8;

export function ProductShelf({
  title,
  description,
  products,
  isLoading,
  isError = false,
  to,
  linkLabel = 'Ver todos',
  skeletonCount = DEFAULT_SKELETON_COUNT,
  tinted = false,
  className,
}: ProductShelfProps) {
  const titleId = useId();

  if (isError || (!isLoading && (products === undefined || products.length === 0))) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      // Enquanto carrega, quem usa leitor de tela ouve a regiao como ocupada
      // — que e o que os esqueletos contam a quem ve.
      aria-busy={isLoading || undefined}
      className={cx(styles.shelf, tinted && styles.tinted, className)}
    >
      <Container>
        <SectionHeading title={title} description={description} titleId={titleId} />

        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: skeletonCount }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))
            : products?.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>

        {to ? (
          <div className={styles.footer}>
            <ButtonLink to={to} variant="secondary">
              {linkLabel}
            </ButtonLink>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
