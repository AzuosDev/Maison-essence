import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import { Field, controlClass, useFieldWiring, type FieldOwnProps } from './field';
import styles from './textarea.module.css';

/**
 * A área de texto: descrição do produto, observação do pedido, página
 * institucional.
 *
 * O contador de caracteres e opcional e aparece quando há `maxLength`. Ele e
 * `aria-live="polite"`: quem usa leitor de tela ouve que esta chegando ao
 * limite ao parar de digitar, em vez de descobrir no envio recusado.
 */
export type TextareaProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> & {
    /** Mostra `120 / 500` embaixo. Exige `maxLength` e `value`. */
    showCount?: boolean;
    textareaClassName?: string | undefined;
  };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    hideLabel,
    block,
    className,
    showCount = false,
    textareaClassName,
    id,
    required,
    rows = 4,
    maxLength,
    value,
    ...props
  },
  ref,
) {
  const wiring = useFieldWiring(id, { hint, error });

  const length = typeof value === 'string' ? value.length : 0;
  const over = maxLength !== undefined && length > maxLength;

  return (
    <Field
      wiring={wiring}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      block={block}
      required={required}
      className={className}
    >
      <textarea
        ref={ref}
        id={wiring.id}
        rows={rows}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={wiring.describedBy}
        className={cx(controlClass, styles.textarea, textareaClassName)}
        {...props}
      />

      {showCount && maxLength !== undefined ? (
        <span className={cx(styles.counter, over && styles.counterOver)} aria-live="polite">
          {length} / {maxLength}
        </span>
      ) : null}
    </Field>
  );
});
