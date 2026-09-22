import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './card.module.css';

/**
 * O cartao, e as tres partes que ele costuma ter.
 *
 * `Card` sozinho ja serve — e uma superficie com borda e raio. `CardHeader`,
 * `CardBody` e `CardFooter` existem para o formato que se repete: o passo do
 * checkout, que e titulo de 18px, campos empilhados e botao largo embaixo,
 * separado por uma linha.
 *
 * `Card` nao e clicavel por conta propria. Quando o cartao inteiro leva a
 * algum lugar — o card de produto —, quem leva e um `<a>` por dentro, com o
 * nome do produto como conteudo: um cartao inteiro virado em botao e
 * anunciado como um bloco de texto enorme e sem rotulo.
 */

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  /** Sem `padding`: a imagem do card de produto encosta na borda. */
  flush?: boolean;
  /** `padding` uniforme, para o cartao que e um bloco so. */
  padded?: boolean;
  /** Sobe 2px no hover. So para o cartao que leva a algum lugar. */
  interactive?: boolean;
  /** A sombra ja em repouso: o cartao que flutua sobre o fundo creme. */
  raised?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { flush = false, padded = false, interactive = false, raised = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        styles.card,
        flush && styles.flush,
        padded && styles.padded,
        interactive && styles.interactive,
        raised && styles.shadow,
        className,
      )}
      {...props}
    />
  );
});

export type CardHeaderProps = ComponentPropsWithoutRef<'div'> & {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Um selo ou um botao no canto direito do cabecalho. */
  action?: ReactNode;
  /** O nivel do titulo no documento. O padrao serve a um bloco dentro de uma pagina. */
  as?: 'h2' | 'h3' | 'h4' | 'p';
};

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { title, subtitle, action, as: Title = 'h3', className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx(styles.header, className)} {...props}>
      <Title className={styles.title}>{title}</Title>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      {action}
      {children}
    </div>
  );
});

export type CardBodyProps = ComponentPropsWithoutRef<'div'>;

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx(styles.body, className)} {...props} />;
});

export type CardFooterProps = ComponentPropsWithoutRef<'div'> & {
  /** Acoes lado a lado, alinhadas a direita, a partir de 640px. */
  inline?: boolean;
};

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
  { inline = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(styles.footer, inline && styles.footerInline, className)}
      {...props}
    />
  );
});
