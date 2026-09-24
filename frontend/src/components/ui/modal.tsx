import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { useDialog } from './use-dialog';
import styles from './modal.module.css';

/**
 * O modal: confirmar exclusão, escolher a variante, ler a política de troca.
 *
 * Três coisas o tornam utilizável por quem não usa mouse, e as três vem do
 * `useDialog`: o foco entra no diálogo e não sai dele pelo Tab, o Escape
 * fecha, e ao fechar o foco volta para o botão que abriu.
 *
 * Renderizado por portal, direto no `<body>`. Não e detalhe de arrumação:
 * dentro da árvore, qualquer ancestral com `overflow: hidden`, `transform`
 * ou `z-index` próprio — e o card de produto tem os três — recortaria o
 * modal ou o colocaria atrás do cabeçalho.
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Vai no `<h2>` e e o nome do diálogo para o leitor de tela. */
  title: string;
  /** Uma linha de contexto embaixo do título. */
  description?: ReactNode;
  /** As ações do rodapé. Sem elas, o rodapé não aparece. */
  footer?: ReactNode;
  /** 48rem em vez de 32rem: tabela, formulário longo. */
  wide?: boolean;
  /**
   * Clicar no véu fecha. Ligado por padrão; o passo que não pode ser
   * abandonado no meio — um pagamento em andamento — desliga.
   */
  closeOnOverlayClick?: boolean;
  /** O rótulo do X, para o leitor de tela. */
  closeLabel?: string;
  className?: string | undefined;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  wide = false,
  closeOnOverlayClick = true,
  closeLabel = 'Fechar',
  className,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = `${titleId}-description`;

  const { ref, onOverlayClick } = useDialog<HTMLDivElement>({
    open,
    onClose,
    closeOnOverlayClick,
  });

  if (!open) {
    return null;
  }

  return createPortal(
    // O véu não e um controle e não entra na ordem do Tab de propósito:
    // fechar clicando fora e um atalho de mouse, e o equivalente de teclado
    // já existe e e o Escape, tratado pelo `useDialog`. Um véu focável seria
    // uma parada a mais no caminho de quem navega por teclado, sem ganho.
    // oxlint-disable-next-line click-events-have-key-events, no-static-element-interactions
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        ref={ref}
        // Não e um `<dialog>` nativo: o nativo só prende o foco com
        // `showModal()`, que o move para a camada de topo do navegador e
        // leva junto regras de estilo e de animação próprias. O
        // comportamento que importa — foco preso, Escape, foco devolvido —
        // esta no `useDialog` e vale igual nos dois.
        // oxlint-disable-next-line prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // Recebe o foco quando não há nada focável dentro — um modal só de
        // texto. Sem isto o foco ficaria na página atrás do véu.
        tabIndex={-1}
        className={cx(styles.dialog, wide && styles.wide, className)}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>

            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>

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
