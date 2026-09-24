import { CheckIcon } from '@/components/store';
import {
  CHECKOUT_STEPS,
  CHECKOUT_STEP_LABELS,
  stepNumber,
  type CheckoutStep,
} from '@/features/checkout';
import { cx } from '@/lib/cx';
import styles from './checkout-progress.module.css';

/**
 * Onde o cliente esta, das quatro etapas.
 *
 * A trilha existe por uma razão só, e ela e sobre desistência: um formulário
 * longo sem fim visível faz a pessoa calcular se vale a pena continuar, e no
 * celular essa conta quase sempre termina em não. Quatro passos numerados
 * respondem a pergunta antes de ela ser feita — falta pouco.
 *
 * Os números são a exceção que justifica numerar: aqui a sequência **e** a
 * informação. Não são um enfeite de seção.
 *
 * ## Dois desenhos, um só de cada vez
 *
 * No desktop, os quatro passos com nome, ligados por um filete. No celular
 * não há largura para quatro rótulos legíveis, e espremer os quatro produz
 * aquele texto de 9px que ninguém lê: a trilha vira "Passo 2 de 4" com o
 * nome do passo atual e uma barra que enche.
 *
 * Os dois vivem no mesmo `<nav>` e se alternam por `display: none`, que e o
 * que os tira também da árvore de acessibilidade — quem ouve a página recebe
 * um dos dois, nunca os dois.
 *
 * ## O que e clicável
 *
 * Só o que já ficou para trás. Voltar para conferir o endereço e legitimo e
 * acontece o tempo todo; pular para o pagamento sem ter escolhido a entrega
 * levaria a um passo que não tem como fechar, e o botão seria uma promessa
 * falsa. Os passos que ainda não chegaram não são botões — são texto, e não
 * recebem foco.
 */

export interface CheckoutProgressProps {
  current: CheckoutStep;
  /** Levar o cliente a um passo já cumprido. */
  onGoTo: (step: CheckoutStep) => void;
  /** Durante o envio do pedido, nada leva a lugar nenhum. */
  locked: boolean;
}

export function CheckoutProgress({ current, onGoTo, locked }: CheckoutProgressProps) {
  const currentIndex = CHECKOUT_STEPS.indexOf(current);

  return (
    <nav aria-label="Progresso do checkout" className={styles.progress}>
      <ol className={styles.trail}>
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const isCurrent = step === current;

          return (
            <li
              key={step}
              className={cx(styles.item, done && styles.done, isCurrent && styles.current)}
            >
              {done && !locked ? (
                <button type="button" className={styles.link} onClick={() => { onGoTo(step); }}>
                  <Marker done index={index} />
                  <span className={styles.label}>{CHECKOUT_STEP_LABELS[step]}</span>
                </button>
              ) : (
                <span className={styles.link} aria-current={isCurrent ? 'step' : undefined}>
                  <Marker done={done} index={index} />
                  <span className={styles.label}>{CHECKOUT_STEP_LABELS[step]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.compact}>
        <p className={styles.compactText}>
          <span className={styles.compactCount}>
            Passo {stepNumber(current)} de {CHECKOUT_STEPS.length}
          </span>
          <span className={styles.compactLabel}>{CHECKOUT_STEP_LABELS[current]}</span>
        </p>

        {/* A barra e decoração do que a linha acima já diz por extenso: fora
            da arvore de acessibilidade, sem `role="progressbar"` e sem um
            segundo anuncio do mesmo número. */}
        <div className={styles.track} aria-hidden="true">
          <div
            className={styles.fill}
            style={{ inlineSize: `${(stepNumber(current) / CHECKOUT_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}

/**
 * O círculo com o número do passo — ou o visto, quando ele já passou.
 *
 * O visto substitui o número em vez de acompanha-lo: um círculo com "1" e um
 * tique dentro não cabe, e o número de um passo cumprido não interessa mais.
 */
function Marker({ done, index }: { done: boolean; index: number }) {
  return (
    <span className={styles.marker} aria-hidden="true">
      {done ? <CheckIcon className={styles.check} width={14} height={14} /> : index + 1}
    </span>
  );
}
