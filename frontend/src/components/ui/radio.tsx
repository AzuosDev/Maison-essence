import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import styles from './radio.module.css';

/**
 * A escolha única: forma de pagamento, entrega ou retirada.
 *
 * `Radio` e um `<input type="radio">` de verdade, e isso e o que da a
 * navegação por setas de graça — dentro de um mesmo `name`, o navegador já
 * move a seleção com as setas e tira os não selecionados da ordem do Tab,
 * como a convenção de acessibilidade manda. Uma lista desenhada a mão teria
 * que reimplementar as duas coisas, e quase sempre reimplementa só a
 * primeira.
 *
 * `RadioGroup` e o `<fieldset>` em volta. Ele existe porque um grupo de
 * radios sem `<legend>` e anunciado como opções soltas: quem usa leitor de
 * tela ouve "PIX" e "cartão" sem nunca ouvir "forma de pagamento".
 */

interface RadioGroupContextValue {
  name: string;
  value: string | undefined;
  onChange: ((value: string) => void) | undefined;
}

/**
 * O contexto carrega `name`, valor e callback do grupo para os filhos.
 *
 * Assim a tela escreve `<Radio value="PIX" label="PIX" />` sem repetir o
 * `name` e o `checked` em cada opção — e sem chance de uma delas ficar com
 * o `name` errado e sair do grupo em silêncio.
 */
const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type RadioProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & {
  label: string;
  /** Uma linha de apoio embaixo do rótulo: "em até 12x sem juros". */
  description?: ReactNode;
  /**
   * A opção vira um cartão: moldura, área de toque grande e fundo próprio
   * quando marcada.
   *
   * Para a escolha que domina uma tela inteira — entrega ou retirada, PIX ou
   * cartão — onde um alvo de 20px não corresponde ao peso da decisão, e onde
   * a opção marcada precisa continuar obvia depois que o cliente rolou a
   * página e voltou.
   *
   * A aparência mora aqui, e não na tela que usa, pelo motivo de sempre:
   * dois cartões desenhados em dois CSS Modules divergem no primeiro ajuste,
   * e são justamente as duas escolhas mais importantes do checkout.
   */
  card?: boolean;
  className?: string | undefined;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    label,
    description,
    card = false,
    className,
    disabled,
    id,
    name,
    checked,
    value,
    onChange,
    ...props
  },
  ref,
) {
  const generated = useId();
  const group = useContext(RadioGroupContext);

  const resolvedName = name ?? group?.name;
  const resolvedChecked =
    checked ?? (group?.value === undefined ? undefined : group.value === value);

  return (
    <label
      className={cx(styles.choice, card && styles.card, disabled && styles.disabled, className)}
    >
      <input
        ref={ref}
        type="radio"
        id={id ?? generated}
        name={resolvedName}
        value={value}
        checked={resolvedChecked}
        disabled={disabled}
        onChange={(event) => {
          onChange?.(event);

          if (typeof value === 'string') {
            group?.onChange?.(value);
          }
        }}
        className={styles.input}
        {...props}
      />

      <span className={styles.dot} aria-hidden="true" />

      <span className={styles.label}>
        {label}
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
    </label>
  );
});

export interface RadioGroupProps {
  /** Vai no `<legend>`: o que esta sendo escolhido. */
  legend: string;
  /** O `name` compartilhado. E ele que faz os radios serem um grupo só. */
  name: string;
  /** Controlado por quem usa, junto de `onChange`. */
  value?: string | undefined;
  /** Não controlado: a opção que já vem marcada. */
  defaultValue?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  /** Lado a lado, para opções curtas. */
  horizontal?: boolean;
  error?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function RadioGroup({
  legend,
  name,
  value,
  defaultValue = '',
  onChange,
  horizontal = false,
  error,
  className,
  children,
}: RadioGroupProps) {
  const errorId = `${useId()}-error`;
  const [internal, setInternal] = useState(defaultValue);

  const current = value ?? internal;

  const select = useCallback(
    (next: string) => {
      setInternal(next);
      onChange?.(next);
    },
    [onChange],
  );

  const context = useMemo(
    () => ({ name, value: current, onChange: select }),
    [name, current, select],
  );

  return (
    <fieldset
      className={cx(styles.group, className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className={styles.legend}>{legend}</legend>

      <div className={cx(styles.options, horizontal && styles.horizontal)}>
        <RadioGroupContext.Provider value={context}>{children}</RadioGroupContext.Provider>
      </div>

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
