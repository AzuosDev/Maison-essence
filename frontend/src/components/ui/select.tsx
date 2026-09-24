import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import { Field, controlClass, useFieldWiring, type FieldOwnProps } from './field';
import styles from './select.module.css';

/**
 * O seletor: cidade de entrega, forma de pagamento, status do pedido.
 *
 * Um `<select>` nativo por dentro. No celular isso abre o seletor do
 * sistema — a roda do iOS, a lista do Android — e nenhuma lista desenhada a
 * mao chega perto disso em usabilidade ou em acessibilidade. O que o
 * componente faz e desenhar a caixa e a seta, e cuidar da moldura do campo.
 *
 * As opcoes entram como dados (`options`) e nao como `children`: e o formato
 * que vem da API — cidades, categorias, status — e evita o `.map` repetido
 * em cada tela.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<'select'>, 'className' | 'children'> & {
    options: readonly SelectOption[];
    /**
     * O texto da primeira opcao, desabilitada, para quando nada foi
     * escolhido: "Escolha uma cidade". Sem ele, o `<select>` abre ja com a
     * primeira opcao real marcada e quem nao mexeu no campo parece ter
     * escolhido.
     */
    placeholder?: string;
    selectClassName?: string | undefined;
  };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    hideLabel,
    block,
    className,
    options,
    placeholder,
    selectClassName,
    id,
    required,
    value,
    defaultValue,
    ...props
  },
  ref,
) {
  const wiring = useFieldWiring(id, { hint, error });

  const showingPlaceholder = placeholder !== undefined && (value ?? defaultValue ?? '') === '';

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
        <select
          ref={ref}
          id={wiring.id}
          required={required}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={wiring.describedBy}
          className={cx(
            controlClass,
            styles.select,
            showingPlaceholder && styles.placeholder,
            selectClassName,
          )}
          {...props}
        >
          {placeholder === undefined ? null : (
            // `disabled` para que nao de para voltar a "nao escolhido"
            // depois de escolher, e `value=""` para que o campo continue
            // vazio para o `required`.
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        <span className={styles.chevron} aria-hidden="true" />
      </div>
    </Field>
  );
});
