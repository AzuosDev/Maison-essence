import { useId, type ChangeEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './quantity-stepper.module.css';

/**
 * Quantas unidades o cliente quer levar.
 *
 * Tres controles com papeis diferentes: dois botoes para o caso comum — que
 * e "mais uma" — e um campo para quem vai levar seis e nao quer apertar seis
 * vezes. O campo e um `<input type="number">` de verdade, com `min` e `max`,
 * porque e ele que traz o teclado numerico no celular.
 *
 * Mora em `components/ui` porque nao sabe o que esta contando: a pagina do
 * produto o usa antes de adicionar, e a sacola o usa em cada linha depois de
 * adicionada. Um segundo seletor escrito para a sacola divergiria deste no
 * primeiro ajuste de borda — e as bordas aqui sao quase tudo.
 *
 * ## O teto
 *
 * Quem decide e quem usa: na pagina do produto, o estoque da variante
 * escolhida; na sacola, o estoque que a **cotacao** acabou de informar. O
 * limite e obedecido nos tres controles: o botao de mais desabilita, o campo
 * recusa e o valor digitado a mao e cortado. Deixar passar sete de um
 * produto que tem tres apenas adiaria a recusa para o fim do checkout,
 * depois de o cliente ja ter preenchido tudo.
 *
 * Campo vazio no meio da digitacao nao vira zero nem 1 a forca: quem apaga
 * para digitar "12" precisa poder apagar. O valor so e corrigido quando o
 * campo perde o foco.
 */

export interface QuantityStepperProps {
  value: number;
  /** Teto pelo estoque. Zero desabilita tudo — nao ha o que vender. */
  max: number;
  onChange: (quantity: number) => void;
  /**
   * O rotulo sai da tela, mas nao da arvore de acessibilidade.
   *
   * Para a linha da sacola, onde o nome do produto esta a dois centimetros e
   * escrever "Quantidade" acima de cada uma encheria a gaveta de repeticao.
   * Quem ouve a pagina continua recebendo o rotulo.
   */
  hideLabel?: boolean;
  /** Menor, para caber na linha da sacola ao lado do preco. */
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
            // A correcao acontece aqui, e nao a cada tecla: o campo precisa
            // poder ficar vazio enquanto alguem troca 1 por 12.
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
