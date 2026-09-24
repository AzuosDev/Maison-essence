import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Field, controlClass, useFieldWiring, type FieldOwnProps } from './field';
import styles from './input.module.css';

/**
 * O campo de texto.
 *
 * Recebe `label`, `hint` e `error` e monta a moldura por dentro: nao ha como
 * usar o campo e esquecer o `htmlFor` ou o `aria-describedby`. O resto das
 * props e de `<input>` — `type`, `placeholder`, `maxLength`, `autoComplete`
 * — porque nao ha razao para reinventar o que o HTML ja nomeia.
 */
export type InputProps = FieldOwnProps &
  // `prefix` sai dos tipos nativos: o HTML tem um atributo `prefix` (RDFa,
  // uma string) que nada aqui usa, e mante-lo cruzaria com o nosso na
  // intersecao — o tipo resultante seria `string & ReactNode`, que nenhum
  // icone satisfaz. O componente ja o retira das props antes de espalhar o
  // resto no `<input>`, entao tira-lo do tipo so descreve o que ja acontece.
  Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'prefix'> & {
    /** `R$` no campo de preco, a lupa na busca. */
    prefix?: ReactNode;
    /** `%` no desconto, `kg` no peso. */
    suffix?: ReactNode;
    /** Numero em largura fixa: preco, quantidade, parcela. */
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
          // A presenca da mensagem e o que define o campo como invalido: um
          // so estado, sem prop de `invalid` que possa discordar do erro.
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
