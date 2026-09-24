import { CloseIcon } from '@/components/store';
import type { ReorderPlan } from '@/features/account';
import styles from './reorder-notice.module.css';

export interface ReorderNoticeProps {
  plan: ReorderPlan;
  onDismiss: () => void;
}

/**
 * O que mudou desde aquele pedido.
 *
 * ## Por que isto não e um aviso flutuante
 *
 * Porque o aviso some, e esta informação precisa ficar. Quem repete um
 * pedido de três frascos e leva dois precisa poder reler qual foi o terceiro
 * — depois de abrir a sacola, depois de rolar a página, depois de atender o
 * telefone. Um `toast` de cinco segundos entregaria essa frase exatamente
 * uma vez, e provavelmente enquanto a pessoa olhava para a gaveta da sacola
 * que acabou de abrir.
 *
 * O aviso curto também existe, e confirma o que entrou. Este bloco responde
 * outra pergunta: o que **não** entrou, e por que.
 *
 * ## Duas listas, e não uma
 *
 * "Entrou com menos" e "não entrou" pedem reações diferentes. No primeiro
 * caso não há nada a fazer — o item esta na sacola, só que em menor
 * quantidade. No segundo, o produto saiu do catálogo e o caminho e procurar
 * outro. Junta-las numa lista só de "problemas" obrigaria a ler o motivo de
 * cada linha para descobrir em qual dos dois casos ela esta.
 *
 * ## O motivo e a frase do servidor
 *
 * "Este produto saiu do catálogo." "Essa opção não esta mais a venda." Elas
 * chegam prontas de `POST /cart/quote`, escritas para quem esta comprando —
 * e são as mesmas que a sacola mostra quando um item cai por lá. Reescreve-
 * las aqui criaria duas versões do mesmo recado para divergirem depois.
 */
export function ReorderNotice({ plan, onDismiss }: ReorderNoticeProps) {
  if (plan.adjusted.length === 0 && plan.dropped.length === 0) {
    return null;
  }

  return (
    <section className={styles.notice} aria-labelledby="reorder-notice-title">
      <div className={styles.head}>
        <h2 id="reorder-notice-title" className={styles.title}>
          O catálogo mudou desde este pedido
        </h2>

        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Fechar o aviso do catálogo"
        >
          <CloseIcon />
        </button>
      </div>

      {plan.adjusted.length === 0 ? null : (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Entraram com menos unidades</h3>

          <ul className={styles.list}>
            {plan.adjusted.map((entry) => (
              <li key={`${entry.line.productId}:${entry.line.variantId}`}>
                <strong>{entry.hint.name}</strong>
                {entry.hint.variantLabel === '' ? null : ` · ${entry.hint.variantLabel}`}:{' '}
                {entry.line.quantity} de {entry.requested}, que e o que resta em estoque.
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.dropped.length === 0 ? null : (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Não entraram na sacola</h3>

          <ul className={styles.list}>
            {plan.dropped.map((item) => (
              <li key={item.name}>
                <strong>{item.name}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
