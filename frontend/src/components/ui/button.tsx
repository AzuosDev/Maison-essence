import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/lib/cx';
import styles from './button.module.css';

/**
 * O botao, nas quatro variantes do design system.
 *
 * `Button` e `ButtonLink` existem separados de proposito, e a distincao nao e
 * estetica: `<button>` executa uma acao, `<a>` leva a outro endereco. Quem
 * navega por teclado espera Enter num link e Espaco num botao; quem usa
 * leitor de tela ouve "link" ou "botao"; e so o link abre em nova aba com o
 * meio do mouse. Um `<div onClick>` com cara de botao perde as tres coisas.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonSize = 'default' | 'small';

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa a largura toda: o botao do formulario e o do passo do checkout. */
  block?: boolean;
}

export type ButtonProps = ButtonStyleProps &
  ComponentPropsWithoutRef<'button'> & {
    /**
     * A acao esta em andamento.
     *
     * Desabilita o botao junto, e nao so desenha o circulo: um envio de
     * pedido que aceita o segundo clique cria o segundo pedido.
     */
    loading?: boolean;
    /** O que o leitor de tela anuncia enquanto carrega. */
    loadingLabel?: string;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    block = false,
    loading = false,
    loadingLabel = 'Enviando',
    type = 'button',
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      // `type="button"` por padrao: o padrao do HTML e `submit`, e um botao
      // de "remover item" dentro de um formulario o enviaria sem querer.
      type={type}
      disabled={disabled ?? loading}
      // `aria-busy` e o que conta para o leitor de tela o que o circulo
      // girando conta para quem ve.
      aria-busy={loading || undefined}
      className={cx(buttonClass({ variant, size, block }), loading && styles.loading, className)}
      {...props}
    >
      <span className={styles.label}>{children}</span>

      {loading ? (
        <span className={styles.indicator}>
          <span className={styles.spinner} />
          <span className="visually-hidden">{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
});

export type ButtonLinkProps = ButtonStyleProps & LinkProps;

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'primary', size = 'default', block = false, className, ...props },
  ref,
) {
  return (
    <Link ref={ref} className={cx(buttonClass({ variant, size, block }), className)} {...props} />
  );
});

function buttonClass({ variant, size, block }: Required<ButtonStyleProps>): string {
  return cx(
    styles.button,
    styles[variant],
    size === 'small' && styles.small,
    block && styles.block,
  );
}
