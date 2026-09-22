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
 * A trilha existe por uma razao so, e ela e sobre desistencia: um formulario
 * longo sem fim visivel faz a pessoa calcular se vale a pena continuar, e no
 * celular essa conta quase sempre termina em nao. Quatro passos numerados
 * respondem a pergunta antes de ela ser feita — falta pouco.
 *
 * Os numeros sao a excecao que justifica numerar: aqui a sequencia **e** a
 * informacao. Nao sao um enfeite de secao.
 *
 * ## Dois desenhos, um so de cada vez
 *
 * No desktop, os quatro passos com nome, ligados por um filete. No celular
 * nao ha largura para quatro rotulos legiveis, e espremer os quatro produz
 * aquele texto de 9px que ninguem le: a trilha vira "Passo 2 de 4" com o
 * nome do passo atual e uma barra que enche.
 *
 * Os dois vivem no mesmo `<nav>` e se alternam por `display: none`, que e o
 * que os tira tambem da arvore de acessibilidade — quem ouve a pagina recebe
 * um dos dois, nunca os dois.
 *
 * ## O que e clicavel
 *
 * So o que ja ficou para tras. Voltar para conferir o endereco e legitimo e
 * acontece o tempo todo; pular para o pagamento sem ter escolhido a entrega
 * levaria a um passo que nao tem como fechar, e o botao seria uma promessa
 * falsa. Os passos que ainda nao chegaram nao sao botoes — sao texto, e nao
 * recebem foco.
 */

export interface CheckoutProgressProps {
  current: CheckoutStep;
  /** Levar o cliente a um passo ja cumprido. */
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

        {/* A barra e decoracao do que a linha acima ja diz por extenso: fora
            da arvore de acessibilidade, sem `role="progressbar"` e sem um
            segundo anuncio do mesmo numero. */}
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
 * O circulo com o numero do passo — ou o visto, quando ele ja passou.
 *
 * O visto substitui o numero em vez de acompanha-lo: um circulo com "1" e um
 * tique dentro nao cabe, e o numero de um passo cumprido nao interessa mais.
 */
function Marker({ done, index }: { done: boolean; index: number }) {
  return (
    <span className={styles.marker} aria-hidden="true">
      {done ? <CheckIcon className={styles.check} width={14} height={14} /> : index + 1}
    </span>
  );
}
