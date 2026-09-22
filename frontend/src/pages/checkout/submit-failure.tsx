import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ORDER_FAILURE_KINDS, type OrderFailure } from '@/features/checkout';
import styles from './submit-failure.module.css';

/**
 * O pedido nao saiu — e o que a tela oferece depende do motivo.
 *
 * Fica ao lado do botao, e nao num toast: e a definicao de aviso que nao pode
 * ser perdido. Enquanto ele estiver ali, o fluxo esta parado.
 *
 * Em todos os casos a sacola continua intacta e nada foi cobrado, e o texto
 * diz isso. E a duvida real de quem ve um erro na ultima tela de uma compra —
 * "perdi o que eu tinha?", "sera que foi e cobrou?" — e nao responde-la e o
 * que faz a pessoa fechar a aba.
 *
 * ## O limite de envios e o unico que nao oferece repetir na hora
 *
 * O `429` chega, quase sempre, para quem ja tentou varias vezes seguidas — e
 * alguma dessas tentativas pode ter dado certo sem a tela perceber (a
 * resposta se perdeu no caminho, a conexao caiu depois do `201`). Um botao
 * pronto para repetir ali seria um convite a criar o segundo pedido igual.
 *
 * Por isso a espera: o botao volta em meio minuto, e ate la o texto pede o
 * unico passo que resolve os dois casos — conferir a conversa no WhatsApp,
 * onde o pedido, se existe, ja apareceu.
 */

export interface SubmitFailureProps {
  failure: OrderFailure;
  onRetry: () => void;
  /** Um envio em curso: o botao de repetir sai de cena. */
  isSubmitting: boolean;
}

/** Quanto tempo o botao de repetir fica fora do ar depois de um `429`. */
const WAIT_SECONDS = 30;

export function SubmitFailure({ failure, onRetry, isSubmitting }: SubmitFailureProps) {
  const limited = failure.kind === ORDER_FAILURE_KINDS.RATE_LIMIT;
  const remaining = useCountdown(limited ? WAIT_SECONDS : 0);

  return (
    <div className={styles.panel} role="alert">
      <p className={styles.title}>{TITLES[failure.kind]}</p>

      <p className={styles.message}>{failure.message}</p>

      <p className={styles.reassurance}>
        {limited
          ? 'Antes de enviar de novo, confira o WhatsApp da loja: se uma das tentativas passou, o pedido ja esta la. Sua sacola continua intacta.'
          : 'Nenhum pedido foi criado e nada foi cobrado. Sua sacola continua com tudo o que voce escolheu.'}
      </p>

      <Button
        variant="secondary"
        onClick={onRetry}
        disabled={isSubmitting || remaining > 0}
        loading={isSubmitting}
        loadingLabel="Enviando o pedido"
      >
        {remaining > 0 ? `Tentar de novo em ${remaining}s` : 'Tentar de novo'}
      </Button>
    </div>
  );
}

/**
 * A contagem regressiva do botao.
 *
 * Um `setInterval` so, encerrado quando chega a zero: um temporizador por
 * segundo que continua girando depois de terminar e o vazamento classico
 * desse tipo de componente.
 *
 * Nao ha reinicio aqui dentro, de proposito. Quem reinicia e a etapa de
 * revisao, que monta este painel com `key={failure.at}`: uma falha nova e um
 * componente novo, com a contagem comecando do zero pela propria construcao.
 * Reiniciar por efeito faria o mesmo trabalho com um render a mais e uma
 * dependencia para manter.
 */
function useCountdown(seconds: number): number {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (seconds === 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);

          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [seconds]);

  return remaining;
}

/**
 * O titulo nomeia o que aconteceu, do ponto de vista de quem esta comprando.
 *
 * "Sem conexao" e uma informacao acionavel; "Erro ao criar pedido" descreve o
 * programa e deixa a pessoa sem saber o que fazer a seguir.
 */
const TITLES: Record<OrderFailure['kind'], string> = {
  [ORDER_FAILURE_KINDS.OFFLINE]: 'Nao conseguimos falar com o servidor',
  [ORDER_FAILURE_KINDS.RATE_LIMIT]: 'Muitas tentativas seguidas',
  [ORDER_FAILURE_KINDS.GENERIC]: 'O pedido nao foi enviado',
};
