import { CheckIcon } from '@/components/store';
import { orderTimeline, type CustomerOrderDetail } from '@/features/account';
import { cx } from '@/lib/cx';
import { formatDateTime, toDateTimeAttribute } from '@/lib/format';
import styles from './order-timeline.module.css';

/**
 * O andamento do pedido, passo a passo.
 *
 * ## O que esta tela **não** inventa
 *
 * O pedido guarda duas datas: quando foi feito e quando mudou pela última
 * vez. Não há, na API publica, um registro por transição. Então um pedido
 * entregue mostra "Confirmado" e "Em preparo" como cumpridos e **sem data** —
 * porque eles foram cumpridos e a data não existe deste lado.
 *
 * A alternativa seria distribuir datas plausíveis entre os passos. Ficaria
 * mais bonito e seria mentira: alguém cobraria a loja por um prazo que um
 * `Math` escreveu.
 *
 * O rodapé explica a ausência em uma linha, e só aparece quando há ausência.
 * Sem ele, o buraco pareceria defeito.
 *
 * ## A trilha não e uma barra de progresso
 *
 * Cada passo traz o que significa — "Seu pedido esta sendo separado e
 * embalado" —, porque "Em preparo" sozinho não diz se alguém já pegou o
 * frasco da prateleira. E os passos futuros ficam apagados e visíveis, e não
 * escondidos: saber que ainda faltam dois e parte de saber onde se esta.
 */
export function OrderTimeline({ order }: { order: CustomerOrderDetail }) {
  const steps = orderTimeline({
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    mode: order.fulfillment.mode,
  });

  const hasUndated = steps.some((step) => step.state === 'done' && step.at === null);

  return (
    <div className={styles.timeline}>
      <ol className={styles.list}>
        {steps.map((step) => (
          <li key={step.status} className={cx(styles.step, styles[step.state])}>
            <span className={styles.marker} aria-hidden="true">
              {step.state === 'done' ? <CheckIcon className={styles.check} /> : null}
            </span>

            <div className={styles.body}>
              <p className={styles.label}>
                {step.label}

                {step.state === 'current' ? (
                  <span className={styles.now}>agora</span>
                ) : (
                  <span className="visually-hidden">
                    {step.state === 'done' ? 'passo cumprido' : 'ainda não aconteceu'}
                  </span>
                )}
              </p>

              <p className={styles.description}>{step.description}</p>

              {step.at === null ? null : (
                <time className={styles.at} dateTime={toDateTimeAttribute(step.at)}>
                  {formatDateTime(step.at)}
                </time>
              )}
            </div>
          </li>
        ))}
      </ol>

      {hasUndated ? (
        <p className={styles.note}>
          O pedido registra a data em que foi feito e a da última mudanca. Os passos do meio ficam
          sem horário.
        </p>
      ) : null}
    </div>
  );
}
