import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Field, controlClass, useFieldWiring, type FieldOwnProps } from './field';
import styles from './input.module.css';

/**
 * O campo de texto.
 *
 * Recebe `label`, `hint` e `error` e monta a moldura por dentro: não há como
 * usar o campo e esquecer o `htmlFor` ou o `aria-describedby`. O resto das
 * props e de `<input>` — `type`, `placeholder`, `maxLength`, `autoComplete`
 * — porque não há razão para reinventar o que o HTML já nomeia.
 */
export type InputProps = FieldOwnProps &
  // `prefix` sai dos tipos nativos: o HTML tem um atributo `prefix` (RDFa,
  // uma string) que nada aqui usa, e mante-lo cruzaria com o nosso na
  // interseção — o tipo resultante seria `string & ReactNode`, que nenhum
  // ícone satisfaz. O componente já o retira das props antes de espalhar o
  // resto no `<input>`, então tira-lo do tipo só descreve o que já acontece.
  Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'prefix'> & {
    /** `R$` no campo de preço, a lupa na busca. */
    prefix?: ReactNode;
    /** `%` no desconto, `kg` no peso. */
    suffix?: ReactNode;
    /** Número em largura fixa: preço, quantidade, parcela. */
    numeric?: boolean;
    /** Classe do campo em si, quando a tela precisa ajustar a largura. */
    inputClassName?: string | undefined;
  };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    hideLabel,
    block,
    className,
    prefix,
    suffix,
    numeric = false,
    inputClassName,
    id,
    required,
    ...props
  },
  ref,
) {
  const wiring = useFieldWiring(id, { hint, error });

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
      <div className={styles.wrapper}>
        {prefix ? <span className={cx(styles.affix, styles.prefix)}>{prefix}</span> : null}

        <input
          ref={ref}
          id={wiring.id}
          required={required}
          // A presença da mensagem e o que define o campo como inválido: um
          // só estado, sem prop de `invalid` que possa discordar do erro.
          aria-invalid={error ? true : undefined}
          aria-describedby={wiring.describedBy}
          className={cx(
            controlClass,
            numeric && styles.numeric,
            Boolean(prefix) && styles.hasPrefix,
            Boolean(suffix) && styles.hasSuffix,
            inputClassName,
          )}
          {...props}
        />

        {suffix ? <span className={cx(styles.affix, styles.suffix)}>{suffix}</span> : null}
      </div>
    </Field>
  );
});
