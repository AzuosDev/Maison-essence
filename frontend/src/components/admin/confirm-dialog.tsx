import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';
import styles from './confirm-dialog.module.css';

/**
 * A confirmacao de uma acao que nao se desfaz.
 *
 * ## Por que o alvo aparece em destaque
 *
 * "Tem certeza?" e uma pergunta que ninguem le — ela chega sempre igual, e
 * o dedo ja esta no botao antes de a frase terminar. O que faz alguem parar
 * e ver **o nome do que vai ser atingido**: `rayane@maisonessence.test` numa
 * linha propria, em fonte de codigo, com o contorno em volta.
 *
 * E a diferenca entre confirmar a acao e confirmar o alvo. Na tabela de
 * usuarios, onde as linhas sao parecidas e o menu de acoes abre no mesmo
 * lugar, e a unica defesa real contra desativar a conta errada.
 *
 * ## O botao perigoso nao e o padrao
 *
 * O foco entra no dialogo pelo `useDialog` e para no primeiro controle, que
 * e "Cancelar". Quem apertou Enter por reflexo cancela; para confirmar e
 * preciso um Tab a mais ou um clique. O custo e um toque; o beneficio e que
 * o reflexo nunca executa a acao.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** "Desativar este usuario?" — a pergunta, curta. */
  title: string;
  /** O que vai acontecer, em uma ou duas frases. */
  description: ReactNode;
  /**
   * O nome do alvo: o e-mail do usuario, o codigo do pedido, o nome do
   * produto. E o que a pessoa confere antes de confirmar.
   */
  target: string;
  /** "Desativar", "Excluir", "Resetar a senha". Nunca "OK". */
  confirmLabel: string;
  /** Acoes que so mudam de estado usam `secondary` em vez do vermelho. */
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
      // Fechar clicando fora fica ligado: abandonar a confirmacao e sempre
      // seguro. O que nao pode ser facil e confirmar.
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
