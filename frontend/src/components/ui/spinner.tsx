import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import styles from './spinner.module.css';

/**
 * O indicador de espera.
 *
 * O elemento e um `<output>`, que já tem `role="status"` embutido: sem um
 * anuncio, quem não vê o círculo girando não recebe aviso nenhum de que a
 * página esta carregando — o conteúdo simplesmente aparece, ou não aparece.
 *
 * Não há versão "dentro do botão" aqui: botão carregando e estado do botão,
 * e mora no próprio `Button`.
 */
export type SpinnerProps = ComponentPropsWithoutRef<'output'> & {
  size?: 'small' | 'medium' | 'large';
  /** Ocupa metade da janela: e o `fallback` de uma rota carregando. */
  page?: boolean;
  /** O que o leitor de tela anuncia. */
  label?: string;
};

export const Spinner = forwardRef<HTMLOutputElement, SpinnerProps>(function Spinner(
  { size = 'medium', page = false, label = 'Carregando', className, ...props },
  ref,
) {
  return (
    <output ref={ref} className={cx(styles.wrapper, page && styles.page, className)} {...props}>
      <span className={cx(styles.spinner, styles[size])} />
      <span className="visually-hidden">{label}</span>
    </output>
  );
});
