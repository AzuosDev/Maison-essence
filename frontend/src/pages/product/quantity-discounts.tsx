import { useId } from 'react';
import { linePricing, nextTierFor, tierFor, type QuantityDiscountTier } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './quantity-discounts.module.css';

/**
 * A escada do desconto progressivo: quanto se ganha levando mais.
 *
 * O card da vitrine anuncia só o primeiro degrau — "leve 3 e ganhe 10%" —
 * porque e a chamada mais barata de atender. Aqui aparece a escada inteira,
 * com **o valor em reais de cada degrau**, que e o número que decide a
 * compra: "ganhe 15%" e abstrato, "economize R$ 85,50" não.
 *
 * Cada degrau e um botão: clicar ajusta a quantidade para o mínimo dele. E a
 * diferença entre informar que existe um desconto e deixar o cliente
 * aproveita-lo sem contar nos dedos.
 *
 * As contas saem de `linePricing`, que e a mesma regra do servidor. O valor
 * final continua sendo o da cotação — o que esta aqui e a promessa que ela
 * vai cumprir.
 */

export interface QuantityDiscountsProps {
  ladder: readonly QuantityDiscountTier[];
  quantity: number;
  unitPriceCents: number;
  /** Ajusta a quantidade ao degrau escolhido. O teto do estoque vale. */
  onChoose: (quantity: number) => void;
}

export function QuantityDiscounts({
  ladder,
  quantity,
  unitPriceCents,
  onChoose,
}: QuantityDiscountsProps) {
  const titleId = useId();

  if (ladder.length === 0) {
    return null;
  }

  const active = tierFor(ladder, quantity);
  const next = nextTierFor(ladder, quantity);

  return (
    <section className={styles.block} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId}>
        Leve mais e pague menos
      </h2>

      <ul className={styles.tiers}>
        {ladder.map((tier) => {
          const savings = linePricing(unitPriceCents, tier.minQty, ladder).savingsCents;
          const reached = active !== null && active.minQty === tier.minQty;

          return (
            <li key={tier.minQty}>
              <button
                type="button"
                className={cx(styles.tier, reached && styles.reached)}
                aria-current={reached ? 'true' : undefined}
                onClick={() => {
                  onChoose(tier.minQty);
                }}
              >
                <span className={styles.quantity}>{tier.minQty} unidades</span>
                <span className={styles.percent}>-{tier.percentOff}%</span>
                <span className={cx(styles.savings, 'tabular')}>
                  economize {formatCents(savings)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {next === null ? null : (
        <p className={styles.nudge} aria-live="polite">
          {missingLabel(next.minQty - quantity)} para ganhar {next.percentOff}% de desconto.
        </p>
      )}
    </section>
  );
}

/** `Falta 1` ou `Faltam 2`: a concordância que a frase pede. */
function missingLabel(missing: number): string {
  return missing === 1 ? 'Falta 1 unidade' : `Faltam ${String(missing)} unidades`;
}
