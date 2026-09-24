import { Skeleton } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './product-card.module.css';

/**
 * O card antes de o produto chegar.
 *
 * Mora em arquivo próprio mas importa **a mesma folha de estilo do card**, e
 * essa e a única razão de ele funcionar: `.card`, `.media`, `.brand`,
 * `.nameRow`, `.prices`, `.installment`, `.promo` e `.action` são as classes
 * do original, com as mesmas alturas reservadas. Um esqueleto com medidas
 * próprias e um esqueleto que começa igual e vai divergindo a cada ajuste no
 * card — e a divergência só aparece como um solavanco na grade, que ninguém
 * associa ao commit que a causou.
 *
 * Sem `aria-hidden` aqui: o `Skeleton` já o traz, e quem anuncia o
 * carregamento e a própria prateleira, pelo `aria-busy`.
 */
export function ProductCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.media}>
        <Skeleton className={styles.mediaGhost} />
      </div>

      <div className={styles.body}>
        <p className={styles.brand}>
          <Skeleton width="40%" height="0.7em" />
        </p>

        <div className={cx(styles.nameRow, styles.nameGhost)}>
          <Skeleton height="0.7rem" />
          <Skeleton width="65%" height="0.7rem" />
        </div>

        <p className={styles.prices}>
          <Skeleton width="55%" height="1rem" />
        </p>

        <p className={styles.installment}>
          <Skeleton width="70%" height="0.7em" />
        </p>

        <p className={styles.promo}>
          <Skeleton width="45%" height="0.7em" />
        </p>

        <div className={styles.action}>
          <Skeleton className={styles.actionGhost} />
        </div>
      </div>
    </div>
  );
}
