import { forwardRef, useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import { useFieldWiring } from './field';
import styles from './checkbox.module.css';

/**
 * A caixa de marcar: "lembrar de mim", "aceito", "selecionar todos".
 *
 * O rótulo e um `<label>` em volta de tudo, e não um texto ao lado: o alvo
 * de toque passa a ser a linha inteira, o que no celular e a diferença entre
 * marcar de primeira e errar duas vezes.
 */
export type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  /**
   * Nem marcado nem desmarcado: o "selecionar todos" quando só alguns estão.
   *
   * E uma propriedade do elemento e não um atributo — não existe
   * `indeterminate` no HTML —, por isso ela e aplicada por efeito.
   */
  indeterminate?: boolean;
  className?: string | undefined;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, indeterminate = false, className, id, disabled, ...props },
  ref,
) {
  const wiring = useFieldWiring(id, { hint, error });
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className={cx(styles.wrapper, error && styles.invalid, className)}>
      <label className={cx(styles.choice, disabled && styles.disabled)}>
        <input
          ref={(node) => {
            innerRef.current = node;

            // O ref de fora continua valendo: quem usa o componente pode
            // precisar do elemento para focar ou medir.
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="checkbox"
          id={wiring.id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={wiring.describedBy}
          className={styles.input}
          {...props}
        />

        <span className={styles.box} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
      </label>

      {hint && !error ? (
        <p id={wiring.hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={wiring.errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
