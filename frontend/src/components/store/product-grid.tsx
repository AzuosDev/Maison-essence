import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-card-skeleton';
import type { PublicProduct } from '@/features/catalog';
import { cx } from '@/lib/cx';
import styles from './product-grid.module.css';

/**
 * A grade de produtos da listagem, da categoria e da busca.
 *
 * E a irma da prateleira da home, com uma diferença de propósito: a
 * prateleira e uma vitrine curta e some quando esta vazia; a grade e o
 * conteúdo principal da página e nunca decide sozinha desaparecer — quem
 * cuida do vazio e a tela, que sabe se o caso e "nenhum resultado para este
 * filtro" ou "esta categoria ainda não tem produto".
 *
 * ## Os esqueletos
 *
 * São os mesmos do card, com as mesmas classes, e por isso tem exatamente a
 * altura dele. A grade também não muda de contagem entre o esqueleto e o
 * resultado: `skeletonCount` e a página cheia, então a barra de rolagem não
 * encolhe quando os produtos chegam.
 *
 * `appending` e o "carregar mais" do celular: os produtos já carregados
 * continuam em tela e os esqueletos entram embaixo, no lugar exato onde a
 * próxima página vai cair.
 */

/**
 * O `sizes` desta grade.
 *
 * Diferente do padrão do card porque aqui a grade divide a largura com a
 * barra de filtros: no desktop a coluna de conteúdo não e a tela inteira, e
 * pedir `25vw` faria o navegador baixar uma foto maior do que a que cabe.
 */
const GRID_SIZES =
  '(min-width: 80rem) 22vw, (min-width: 64rem) 28vw, (min-width: 48rem) 33vw, 50vw';

export interface ProductGridProps {
  products: readonly PublicProduct[];
  isLoading: boolean;
  /** Uma página a mais chegando, embaixo da que já esta em tela. */
  appending?: boolean;
  /** O termo buscado, realcado nos nomes. Só a busca passa. */
  highlight?: string;
  /** Quantos esqueletos desenhar. O padrão e a página cheia. */
  skeletonCount?: number;
  className?: string | undefined;
}

const DEFAULT_SKELETON_COUNT = 12;

export function ProductGrid({
  products,
  isLoading,
  appending = false,
  highlight = '',
  skeletonCount = DEFAULT_SKELETON_COUNT,
  className,
}: ProductGridProps) {
  return (
    <div className={cx(styles.grid, className)} aria-busy={isLoading || appending || undefined}>
      {isLoading
        ? null
        : products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              sizes={GRID_SIZES}
              highlight={highlight}
            />
          ))}

      {isLoading || appending
        ? Array.from({ length: skeletonCount }, (_, index) => <ProductCardSkeleton key={index} />)
        : null}
    </div>
  );
}
