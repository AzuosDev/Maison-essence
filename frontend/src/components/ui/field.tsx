import { useId, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './field.module.css';

/**
 * O que Input, Select e Textarea tem em comum.
 *
 * A moldura — rotulo, ajuda, erro — e a ligacao entre eles. A ligacao e o
 * ponto: o `htmlFor` que faz clicar no rotulo focar o campo, o
 * `aria-describedby` que faz o leitor de tela ler a ajuda junto do campo, e
 * o `aria-invalid` que anuncia o erro. Feito a mao em cada tela, um desses
 * tres se perde sempre.
 *
 * Por isso os controles recebem `label`, `hint` e `error` como props e
 * montam a moldura por dentro, em vez de a tela montar a moldura em volta:
 * nao ha como usar o campo e esquecer a ligacao.
 */

/**
 * O `| undefined` explicito em cada campo nao e ruido.
 *
 * Com `exactOptionalPropertyTypes` ligado, `label?: string` recusa receber
 * uma variavel do tipo `string | undefined` — e e exatamente isso que cada
 * controle tem em maos para repassar. Sem os `| undefined`, todo repasse
 * viraria um `{...(label === undefined ? {} : { label })}`.
 */
export interface FieldOwnProps {
  label?: string | undefined;
  /** Texto de apoio. Some quando ha erro — dois recados competem. */
  hint?: string | undefined;
  /** A mensagem de validacao. Sua presenca e o que marca o campo invalido. */
  error?: string | undefined;
  /** Mantem o rotulo so para o leitor de tela: busca, filtro de uma coluna. */
  hideLabel?: boolean | undefined;
  /** Ocupa a largura toda. E o que um campo de formulario quase sempre quer. */
  block?: boolean | undefined;
  className?: string | undefined;
}

/** Os ids e os atributos que o controle precisa receber. */
export interface FieldWiring {
  id: string;
  describedBy: string | undefined;
  hintId: string;
  errorId: string;
}

export function useFieldWiring(
  providedId: string | undefined,
  { hint, error }: Pick<FieldOwnProps, 'hint' | 'error'>,
): FieldWiring {
  const generated = useId();
  const id = providedId ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return {
    id,
    hintId,
    errorId,
    // O erro tem precedencia: enquanto ele existe, e ele que o campo anuncia.
    describedBy: error ? errorId : hint ? hintId : undefined,
  };
}

interface FieldProps extends FieldOwnProps {
  wiring: FieldWiring;
  required?: boolean | undefined;
  children: ReactNode;
}

export function Field({
  wiring,
  label,
  hint,
  error,
  hideLabel = false,
  block = true,
  required = false,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx(styles.field, block && styles.block, className)}>
      {label ? (
        <label htmlFor={wiring.id} className={cx(styles.label, hideLabel && 'visually-hidden')}>
          {label}
          {required ? (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {hint && !error ? (
        <p id={wiring.hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {error ? (
        // `role="alert"` para que a mensagem seja lida no momento em que
        // aparece — depois do envio recusado, quem usa leitor de tela nao
        // fica procurando o que deu errado.
        <p id={wiring.errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A classe da base visual dos tres controles. */
export const controlClass = styles.control;
