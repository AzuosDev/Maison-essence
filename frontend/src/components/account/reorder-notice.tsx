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
 * ## Por que isto nao e um aviso flutuante
 *
 * Porque o aviso some, e esta informacao precisa ficar. Quem repete um
 * pedido de tres frascos e leva dois precisa poder reler qual foi o terceiro
 * — depois de abrir a sacola, depois de rolar a pagina, depois de atender o
 * telefone. Um `toast` de cinco segundos entregaria essa frase exatamente
 * uma vez, e provavelmente enquanto a pessoa olhava para a gaveta da sacola
 * que acabou de abrir.
 *
 * O aviso curto tambem existe, e confirma o que entrou. Este bloco responde
 * outra pergunta: o que **nao** entrou, e por que.
 *
 * ## Duas listas, e nao uma
 *
 * "Entrou com menos" e "nao entrou" pedem reacoes diferentes. No primeiro
 * caso nao ha nada a fazer — o item esta na sacola, so que em menor
 * quantidade. No segundo, o produto saiu do catalogo e o caminho e procurar
 * outro. Junta-las numa lista so de "problemas" obrigaria a ler o motivo de
 * cada linha para descobrir em qual dos dois casos ela esta.
 *
 * ## O motivo e a frase do servidor
 *
 * "Este produto saiu do catalogo." "Essa opcao nao esta mais a venda." Elas
 * chegam prontas de `POST /cart/quote`, escritas para quem esta comprando —
 * e sao as mesmas que a sacola mostra quando um item cai por la. Reescreve-
 * las aqui criaria duas versoes do mesmo recado para divergirem depois.
 */
export function ReorderNotice({ plan, onDismiss }: ReorderNoticeProps) {
  if (plan.adjusted.length === 0 && plan.dropped.length === 0) {
    return null;
  }

  return (
    <section className={styles.notice} aria-labelledby="reorder-notice-title">
      <div className={styles.head}>
        <h2 id="reorder-notice-title" className={styles.title}>
          O catalogo mudou desde este pedido
        </h2>

        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Fechar o aviso do catalogo"
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
