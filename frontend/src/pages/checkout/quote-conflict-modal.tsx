import { Button, Modal } from '@/components/ui';
import {
  QUOTE_MISMATCH_REASONS,
  isConfirmableConflict,
  type QuoteConflict,
} from '@/features/checkout';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './quote-conflict-modal.module.css';

/**
 * O pedido foi recusado porque a conta mudou — e agora e o cliente quem
 * decide.
 *
 * O servidor refaz a cotação inteira antes de gravar e compara com o total
 * que estava na tela. Se o preço subiu, um desconto venceu ou a última
 * unidade acabou entre montar a sacola e apertar o botão, ele responde `409`
 * com a cotação nova. Nada e gravado.
 *
 * Esta e uma das poucas telas do projeto em que um modal e a resposta certa,
 * e não a preguicosa: há uma decisão que não pode ser adiada, o fluxo não
 * pode seguir sem ela, e continuar por baixo — reenviando com o valor novo —
 * significaria cobrar um preço que ninguém viu. Por isso o véu também não
 * fecha por clique: sair daqui e escolher, não escapar.
 *
 * ## Os dois números, lado a lado
 *
 * O valor que estava na tela e o valor recalculado, um ao lado do outro, com
 * a diferença escrita por extenso. E a única forma de a pessoa decidir em
 * dois segundos — comparar dois totais de memória, num modal, e o tipo de
 * esforço que termina em "deixa pra lá".
 *
 * ## Duas saídas diferentes, conforme o motivo
 *
 * Valor ou parcelamento: da para confirmar e seguir, porque não falta nada
 * para o pedido existir — só mudou quanto ele custa.
 *
 * Item indisponível ou estoque perdido: não há o que confirmar. Reenviar a
 * mesma sacola com um item que não existe mais produziria o mesmo `409`, e o
 * botão seria uma promessa que só pode falhar.
 *
 * O que o modal oferece nesse caso e o gesto que resolve: tirar da sacola
 * exatamente os itens que o servidor marcou como indisponíveis. O cliente vê
 * quais são, na lista logo acima do botão, e não precisa procurar entre as
 * próprias linhas qual foi. Quem prefere decidir com calma tem o "revisar os
 * itens" ao lado.
 */

export interface QuoteConflictModalProps {
  conflict: QuoteConflict | null;
  /** O total que estava na tela quando o cliente apertou o botão. */
  previousTotalCents: number;
  /** Segue com o valor novo. Só aparece quando o motivo permite. */
  onConfirm: () => void;
  /**
   * Tira da sacola os itens que o servidor marcou como indisponíveis e volta
   * a etapa de itens. Só aparece quando há algum para tirar.
   */
  onRemoveUnavailable: () => void;
  /** Volta para a etapa de itens, onde o problema pode ser resolvido. */
  onReview: () => void;
  onClose: () => void;
}

export function QuoteConflictModal({
  conflict,
  previousTotalCents,
  onConfirm,
  onRemoveUnavailable,
  onReview,
  onClose,
}: QuoteConflictModalProps) {
  if (conflict === null) {
    return null;
  }

  const newTotalCents = conflict.quote.totalCents;
  const confirmable = isConfirmableConflict(conflict.reason);
  const unavailable = conflict.quote.items.filter((item) => item.unavailable);

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLES[conflict.reason]}
      description={conflict.message}
      // Uma decisão de valor não se fecha por clique fora. O Escape continua
      // funcionando, e o botão de revisar esta a mão: as duas saídas são
      // deliberadas.
      closeOnOverlayClick={false}
      closeLabel="Fechar sem enviar o pedido"
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onReview}>
            {confirmable ? 'Revisar o pedido' : 'Revisar os itens'}
          </Button>

          {confirmable ? <Button onClick={onConfirm}>Continuar com o novo valor</Button> : null}

          {!confirmable && unavailable.length > 0 ? (
            <Button onClick={onRemoveUnavailable}>
              {unavailable.length === 1 ? 'Remover o item' : 'Remover os itens'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className={styles.compare}>
        <div className={styles.column}>
          <p className={styles.label}>Valor que você viu</p>
          <p className={cx(styles.value, styles.old, 'tabular')}>
            {formatCents(previousTotalCents)}
          </p>
        </div>

        <div className={styles.column}>
          <p className={styles.label}>Novo valor</p>
          <p className={cx(styles.value, 'tabular')}>{formatCents(newTotalCents)}</p>
        </div>
      </div>

      <Difference previousTotalCents={previousTotalCents} newTotalCents={newTotalCents} />

      {conflict.reason === QUOTE_MISMATCH_REASONS.ITEMS ||
      conflict.reason === QUOTE_MISMATCH_REASONS.STOCK ? (
        <UnavailableList items={unavailable} />
      ) : null}
    </Modal>
  );
}

/**
 * Quanto mudou, em uma frase.
 *
 * A subtração aqui não e um preço: os dois totais vieram prontos do
 * servidor, ninguém paga por esta diferença e ela não entra em corpo de
 * requisição nenhum. E leitura — a frase que poupa a pessoa de comparar dois
 * números de seis digitos com o olho.
 */
function Difference({
  previousTotalCents,
  newTotalCents,
}: {
  previousTotalCents: number;
  newTotalCents: number;
}) {
  const delta = newTotalCents - previousTotalCents;

  if (delta === 0) {
    return null;
  }

  return (
    <p className={styles.difference}>
      {delta > 0 ? (
        <>
          São <strong className="tabular">{formatCents(delta)}</strong> a mais que o valor
          anterior.
        </>
      ) : (
        <>
          São <strong className="tabular">{formatCents(-delta)}</strong> a menos que o valor
          anterior.
        </>
      )}
    </p>
  );
}

/** Quais itens travaram o pedido, nas palavras que o servidor escreveu. */
function UnavailableList({ items }: { items: QuoteConflict['quote']['items'] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={styles.unavailable}>
      {items.map((item) => (
        <li key={`${item.productId}:${item.variantId}`}>
          <strong>{item.productName}</strong>
          {item.variantLabel === '' ? '' : ` · ${item.variantLabel}`}: {item.unavailableReason}
        </li>
      ))}
    </ul>
  );
}

/**
 * O título nomeia o que aconteceu, e não o que o sistema fez.
 *
 * "O valor do pedido mudou" diz ao cliente o que ele precisa saber. "Erro
 * 409" e "Conflito na cotação" descrevem o programa.
 */
const TITLES: Record<QuoteConflict['reason'], string> = {
  [QUOTE_MISMATCH_REASONS.TOTAL]: 'O valor do pedido mudou',
  [QUOTE_MISMATCH_REASONS.INSTALLMENTS]: 'O parcelamento mudou',
  [QUOTE_MISMATCH_REASONS.ITEMS]: 'Um item saiu do pedido',
  [QUOTE_MISMATCH_REASONS.STOCK]: 'Acabou o estoque de um item',
};
