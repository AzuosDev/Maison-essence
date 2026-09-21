import type { ComponentPropsWithoutRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './button.module.css';

/**
 * O botao, nas tres variantes do design system.
 *
 * `Button` e `ButtonLink` existem separados de proposito, e a distincao nao e
 * estetica: `<button>` executa uma acao, `<a>` leva a outro endereco. Quem
 * navega por teclado espera Enter num link e Espaco num botao; quem usa
 * leitor de tela ouve "link" ou "botao"; e so o link abre em nova aba com o
 * meio do mouse. Um `<div onClick>` com cara de botao perde as tres coisas.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: 'default' | 'small';
  /** Ocupa a largura toda: o botao do formulario e o do passo do checkout. */
  block?: boolean;
}

export type ButtonProps = ButtonStyleProps & ComponentPropsWithoutRef<'button'>;

export function Button({
  variant = 'primary',
  size = 'default',
  block = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      // `type="button"` por padrao: o padrao do HTML e `submit`, e um botao
      // de "remover item" dentro de um formulario o enviaria sem querer.
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = ButtonStyleProps & LinkProps;

export function ButtonLink({
  variant = 'primary',
  size = 'default',
  block = false,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, block }, className)} {...props} />;
}

function buttonClass(
  { variant = 'primary', size = 'default', block = false }: ButtonStyleProps,
  extra?: string,
): string {
  return [
    styles.button,
    styles[variant],
    size === 'small' ? styles.small : null,
    block ? styles.block : null,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}
