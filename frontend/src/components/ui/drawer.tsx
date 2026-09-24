import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { useDialog } from './use-dialog';
import styles from './drawer.module.css';

/**
 * A gaveta: a sacola, o menu de categorias no celular, os filtros do
 * catálogo.
 *
 * E um diálogo como o modal — mesmo `useDialog`, mesmas três obrigações:
 * prende o foco, fecha no Escape, devolve o foco ao gatilho. O que muda e a
 * forma: entra pela lateral e ocupa a altura inteira, porque o conteúdo dela
 * e uma lista que rola, e não uma pergunta curta.
 */

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** De onde entra. A direita para a sacola, a esquerda para o menu. */
  side?: 'right' | 'left';
  /** O rodapé preso embaixo: o total e o botão de fechar pedido. */
  footer?: ReactNode;
  /** 32rem em vez de 26rem. */
  wide?: boolean;
  closeOnOverlayClick?: boolean;
  closeLabel?: string;
  className?: string | undefined;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  footer,
  wide = false,
  closeOnOverlayClick = true,
  closeLabel = 'Fechar',
  className,
  children,
}: DrawerProps) {
  const titleId = useId();

  const { ref, onOverlayClick } = useDialog<HTMLDivElement>({
    open,
    onClose,
    closeOnOverlayClick,
  });

  if (!open) {
    return null;
  }

  return createPortal(
    // O véu fecha no clique, e o equivalente de teclado e o Escape, tratado
    // pelo `useDialog`. Ver a nota em `modal.tsx`.
    // oxlint-disable-next-line click-events-have-key-events, no-static-element-interactions
    <div className={cx(styles.overlay, styles[side])} onClick={onOverlayClick}>
      <div
        ref={ref}
        // oxlint-disable-next-line prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(styles.panel, wide && styles.wide, className)}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>

          <button type="button" onClick={onClose} className={styles.close} aria-label={closeLabel}>
            <span className={styles.closeIcon} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
