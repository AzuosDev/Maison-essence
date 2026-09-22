import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import styles from './skeleton.module.css';

/**
 * O formato do conteudo antes de ele chegar.
 *
 * `aria-hidden` sempre: para quem usa leitor de tela, um retangulo cinza nao
 * e informacao nenhuma, e anunciar vinte deles e ruido. Quem avisa que a
 * pagina esta carregando e o `Spinner`, com o seu `role="status"`, ou o
 * proprio conteudo quando aparece.
 */

export type SkeletonVariant = 'text' | 'title' | 'image' | 'block';

export type SkeletonProps = ComponentPropsWithoutRef<'div'> & {
  variant?: SkeletonVariant;
  /** Circular: a miniatura redonda, o avatar. */
  circle?: boolean;
  /** Largura e altura livres, para o bloco que nao e nenhum dos formatos. */
  width?: string;
  height?: string;
};

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { variant = 'block', circle = false, width, height, className, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx(
        styles.skeleton,
        variant !== 'block' && styles[variant],
        circle && styles.circle,
        className,
      )}
      style={{ ...style, ...(width ? { width } : {}), ...(height ? { height } : {}) }}
      {...props}
    />
  );
});

export type SkeletonTextProps = ComponentPropsWithoutRef<'div'> & {
  /** Quantas linhas. A ultima sai mais curta, como num paragrafo de verdade. */
  lines?: number;
};

export const SkeletonText = forwardRef<HTMLDivElement, SkeletonTextProps>(function SkeletonText(
  { lines = 3, className, ...props },
  ref,
) {
  return (
    <div ref={ref} aria-hidden="true" className={cx(styles.lines, className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cx(styles.skeleton, styles.text, index === lines - 1 && styles.lastLine)}
        />
      ))}
    </div>
  );
});
