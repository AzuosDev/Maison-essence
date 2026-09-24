import type { PublicVariant } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './variant-options.module.css';

/**
 * As opções do produto, em pílulas.
 *
 * ## A esgotada continua na tela
 *
 * Riscada e desabilitada, nunca escondida. Sumir com os 100ml faria o
 * cliente que veio atrás deles concluir que a loja nunca os teve — e ir
 * procurar em outro lugar. Mostrando-os esgotados, ele entende que e questão
 * de voltar depois, e ainda pode levar os 50ml agora.
 *
 * ## Por que radios de verdade
 *
 * São `<input type="radio">` escondidos atrás das pílulas, e não botões com
 * `aria-pressed`. Escolher um tamanho e escolher **um** entre vários, que e
 * exatamente o que o radio significa: o leitor de tela anuncia "2 de 3", as
 * setas do teclado andam entre as opções, e a opção desabilitada sai da
 * ordem do Tab sozinha — sem nenhuma linha de JavaScript para isso.
 */

export interface VariantOptionsProps {
  variants: readonly PublicVariant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
  /** Distingue os grupos quando há mais de um produto na tela. */
  name: string;
}

export function VariantOptions({ variants, selectedId, onSelect, name }: VariantOptionsProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Opções</legend>

      <div className={styles.options}>
        {variants.map((variant) => (
          <label
            key={variant.id}
            className={cx(styles.option, !variant.isAvailable && styles.soldOut)}
          >
            <input
              type="radio"
              name={name}
              value={variant.id}
              checked={variant.id === selectedId}
              disabled={!variant.isAvailable}
              className={styles.input}
              onChange={() => {
                onSelect(variant.id);
              }}
            />

            <span className={styles.pill}>
              {variant.label === '' ? 'Padrão' : variant.label}

              {/* O preço de cada opção evita o vaivem de clicar numa pilula
                  só para descobrir quanto custa. */}
              <span className={cx(styles.price, 'tabular')}>{formatCents(variant.priceCents)}</span>

              {variant.isAvailable ? null : <span className="visually-hidden"> — esgotado</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
