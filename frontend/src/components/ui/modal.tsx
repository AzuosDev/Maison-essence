import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { useDialog } from './use-dialog';
import styles from './modal.module.css';

/**
 * O modal: confirmar exclusao, escolher a variante, ler a politica de troca.
 *
 * Tres coisas o tornam utilizavel por quem nao usa mouse, e as tres vem do
 * `useDialog`: o foco entra no dialogo e nao sai dele pelo Tab, o Escape
 * fecha, e ao fechar o foco volta para o botao que abriu.
 *
 * Renderizado por portal, direto no `<body>`. Nao e detalhe de arrumacao:
 * dentro da arvore, qualquer ancestral com `overflow: hidden`, `transform`
 * ou `z-index` proprio — e o card de produto tem os tres — recortaria o
 * modal ou o colocaria atras do cabecalho.
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Vai no `<h2>` e e o nome do dialogo para o leitor de tela. */
  title: string;
  /** Uma linha de contexto embaixo do titulo. */
  description?: ReactNode;
  /** As acoes do rodape. Sem elas, o rodape nao aparece. */
  footer?: ReactNode;
  /** 48rem em vez de 32rem: tabela, formulario longo. */
  wide?: boolean;
  /**
   * Clicar no veu fecha. Ligado por padrao; o passo que nao pode ser
   * abandonado no meio — um pagamento em andamento — desliga.
   */
  closeOnOverlayClick?: boolean;
  /** O rotulo do X, para o leitor de tela. */
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
    // O veu nao e um controle e nao entra na ordem do Tab de proposito:
    // fechar clicando fora e um atalho de mouse, e o equivalente de teclado
    // ja existe e e o Escape, tratado pelo `useDialog`. Um veu focavel seria
    // uma parada a mais no caminho de quem navega por teclado, sem ganho.
    // oxlint-disable-next-line click-events-have-key-events, no-static-element-interactions
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        ref={ref}
        // Nao e um `<dialog>` nativo: o nativo so prende o foco com
        // `showModal()`, que o move para a camada de topo do navegador e
        // leva junto regras de estilo e de animacao proprias. O
        // comportamento que importa — foco preso, Escape, foco devolvido —
        // esta no `useDialog` e vale igual nos dois.
        // oxlint-disable-next-line prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // Recebe o foco quando nao ha nada focavel dentro — um modal so de
        // texto. Sem isto o foco ficaria na pagina atras do veu.
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
