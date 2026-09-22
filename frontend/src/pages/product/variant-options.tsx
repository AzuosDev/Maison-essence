import type { PublicVariant } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './variant-options.module.css';

/**
 * As opcoes do produto, em pilulas.
 *
 * ## A esgotada continua na tela
 *
 * Riscada e desabilitada, nunca escondida. Sumir com os 100ml faria o
 * cliente que veio atras deles concluir que a loja nunca os teve — e ir
 * procurar em outro lugar. Mostrando-os esgotados, ele entende que e questao
 * de voltar depois, e ainda pode levar os 50ml agora.
 *
 * ## Por que radios de verdade
 *
 * Sao `<input type="radio">` escondidos atras das pilulas, e nao botoes com
 * `aria-pressed`. Escolher um tamanho e escolher **um** entre varios, que e
 * exatamente o que o radio significa: o leitor de tela anuncia "2 de 3", as
 * setas do teclado andam entre as opcoes, e a opcao desabilitada sai da
 * ordem do Tab sozinha — sem nenhuma linha de JavaScript para isso.
 */

export interface VariantOptionsProps {
  variants: readonly PublicVariant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
  /** Distingue os grupos quando ha mais de um produto na tela. */
  name: string;
}

export function VariantOptions({ variants, selectedId, onSelect, name }: VariantOptionsProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Opcoes</legend>

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
              {variant.label === '' ? 'Padrao' : variant.label}

              {/* O preco de cada opcao evita o vaivem de clicar numa pilula
                  so para descobrir quanto custa. */}
              <span className={cx(styles.price, 'tabular')}>{formatCents(variant.priceCents)}</span>

              {variant.isAvailable ? null : <span className="visually-hidden"> — esgotado</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
