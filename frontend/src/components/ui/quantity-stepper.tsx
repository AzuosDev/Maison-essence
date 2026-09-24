import { useId, type ChangeEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './quantity-stepper.module.css';

/**
 * Quantas unidades o cliente quer levar.
 *
 * Três controles com papéis diferentes: dois botões para o caso comum — que
 * e "mais uma" — e um campo para quem vai levar seis e não quer apertar seis
 * vezes. O campo e um `<input type="number">` de verdade, com `min` e `max`,
 * porque e ele que traz o teclado numérico no celular.
 *
 * Mora em `components/ui` porque não sabe o que esta contando: a página do
 * produto o usa antes de adicionar, e a sacola o usa em cada linha depois de
 * adicionada. Um segundo seletor escrito para a sacola divergiria deste no
 * primeiro ajuste de borda — e as bordas aqui são quase tudo.
 *
 * ## O teto
 *
 * Quem decide e quem usa: na página do produto, o estoque da variante
 * escolhida; na sacola, o estoque que a **cotação** acabou de informar. O
 * limite e obedecido nos três controles: o botão de mais desabilita, o campo
 * recusa e o valor digitado a mão e cortado. Deixar passar sete de um
 * produto que tem três apenas adiaria a recusa para o fim do checkout,
 * depois de o cliente já ter preenchido tudo.
 *
 * Campo vazio no meio da digitação não vira zero nem 1 a força: quem apaga
 * para digitar "12" precisa poder apagar. O valor só e corrigido quando o
 * campo perde o foco.
 */

export interface QuantityStepperProps {
  value: number;
  /** Teto pelo estoque. Zero desabilita tudo — não há o que vender. */
  max: number;
  onChange: (quantity: number) => void;
  /**
   * O rótulo sai da tela, mas não da árvore de acessibilidade.
   *
   * Para a linha da sacola, onde o nome do produto esta a dois centimetros e
   * escrever "Quantidade" acima de cada uma encheria a gaveta de repetição.
   * Quem ouve a página continua recebendo o rótulo.
   */
  hideLabel?: boolean;
  /** Menor, para caber na linha da sacola ao lado do preço. */
  size?: 'default' | 'small';
  /** O que esta sendo contado, para quem ouve: `Quantidade de Asad 100ml`. */
  label?: string;
  className?: string | undefined;
}

export function QuantityStepper({
  value,
  max,
  onChange,
  hideLabel = false,
  size = 'default',
  label = 'Quantidade',
  className,
}: QuantityStepperProps) {
  const id = useId();
  const disabled = max <= 0;

  const step = (delta: number): void => {
    onChange(clamp(value + delta, max));
  };

  const type = (event: ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.trim();

    if (digits === '') {
      return;
    }

    onChange(clamp(Number.parseInt(digits, 10), max));
  };

  return (
    <div className={cx(styles.field, className)}>
      <label className={hideLabel ? 'visually-hidden' : styles.label} htmlFor={id}>
        {label}
      </label>

      <div className={cx(styles.stepper, size === 'small' && styles.small)}>
        <button
          type="button"
          className={styles.step}
          onClick={() => {
            step(-1);
          }}
          disabled={disabled || value <= 1}
          aria-label="Diminuir a quantidade"
        >
          –
        </button>

        <input
          id={id}
          type="number"
          inputMode="numeric"
          className={`${styles.input} tabular`}
          value={value}
          min={1}
          max={Math.max(max, 1)}
          step={1}
          disabled={disabled}
          onChange={type}
          onBlur={(event) => {
            // A correção acontece aqui, e não a cada tecla: o campo precisa
            // poder ficar vazio enquanto alguém troca 1 por 12.
            const parsed = Number.parseInt(event.target.value, 10);

            onChange(Number.isNaN(parsed) ? 1 : clamp(parsed, max));
          }}
        />

        <button
          type="button"
          className={styles.step}
          onClick={() => {
            step(1);
          }}
          disabled={disabled || value >= max}
          aria-label="Aumentar a quantidade"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Entre um e o teto, sempre inteiro. */
function clamp(quantity: number, max: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), Math.max(max, 1));
}
