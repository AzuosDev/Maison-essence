import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';
import styles from './confirm-dialog.module.css';

/**
 * A confirmação de uma ação que não se desfaz.
 *
 * ## Por que o alvo aparece em destaque
 *
 * "Tem certeza?" e uma pergunta que ninguém lê — ela chega sempre igual, e
 * o dedo já esta no botão antes de a frase terminar. O que faz alguém parar
 * e ver **o nome do que vai ser atingido**: `rayane@maisonessence.test` numa
 * linha própria, em fonte de código, com o contorno em volta.
 *
 * E a diferença entre confirmar a ação e confirmar o alvo. Na tabela de
 * usuários, onde as linhas são parecidas e o menu de ações abre no mesmo
 * lugar, e a única defesa real contra desativar a conta errada.
 *
 * ## O botão perigoso não e o padrão
 *
 * O foco entra no diálogo pelo `useDialog` e para no primeiro controle, que
 * e "Cancelar". Quem apertou Enter por reflexo cancela; para confirmar e
 * preciso um Tab a mais ou um clique. O custo e um toque; o beneficio e que
 * o reflexo nunca executa a ação.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** "Desativar este usuário?" — a pergunta, curta. */
  title: string;
  /** O que vai acontecer, em uma ou duas frases. */
  description: ReactNode;
  /**
   * O nome do alvo: o e-mail do usuário, o código do pedido, o nome do
   * produto. E o que a pessoa confere antes de confirmar.
   */
  target: string;
  /** "Desativar", "Excluir", "Resetar a senha". Nunca "OK". */
  confirmLabel: string;
  /** Ações que só mudam de estado usam `secondary` em vez do vermelho. */
  tone?: 'danger' | 'neutral';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  target,
  confirmLabel,
  tone = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      // Fechar clicando fora fica ligado: abandonar a confirmação e sempre
      // seguro. O que não pode ser fácil e confirmar.
      footer={
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>

          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className={styles.description}>{description}</p>

      <p className={styles.target}>{target}</p>
    </Modal>
  );
}
