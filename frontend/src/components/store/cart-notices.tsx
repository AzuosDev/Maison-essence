import { useCart, type QuoteLine } from '@/features/cart';
import styles from './cart-notices.module.css';

/**
 * O que mudou na sacola desde a última vez que o cliente olhou.
 *
 * Dois avisos, com pesos deliberadamente diferentes.
 *
 * ## O que saiu, em destaque
 *
 * Produto desativado, opção encerrada, estoque que acabou. Isso muda o que o
 * cliente vai levar e quanto vai pagar, então aparece antes da lista, com
 * fundo próprio, dizendo **quais** itens saíram e **por que** — nas palavras
 * que o servidor escreveu, que são as mesmas que o checkout usaria. Um
 * "alguns itens estão indisponíveis" genérico obrigaria a varrer a lista
 * inteira procurando quais.
 *
 * O botão remove todos de uma vez. E o que quase todo mundo quer fazer, e
 * fazer item a item numa sacola de oito e trabalho que a tela pode poupar.
 * Cada linha continua com o seu próprio "Remover", para quem quer escolher.
 *
 * ## O reajuste, discreto
 *
 * "Os valores foram atualizados" não pede ação nenhuma: o preço em tela já e
 * o novo, já foi calculado pelo servidor e já esta somado. O aviso existe
 * porque quem montou a sacola há uma semana lembra do número antigo, e
 * descobrir a diferença sozinho, no checkout, e pior do que ler uma linha
 * aqui. Por isso e uma linha — e dispensável, porque quem leu não precisa
 * dela de novo.
 *
 * ## Por que não os `warnings` da cotação
 *
 * A resposta traz uma lista pronta, e a sacola não a usa. Ela mistura
 * recados de item com recados de pagamento e de parcelamento — "a loja não
 * esta aceitando cartão", por exemplo —, e a sacola não escolheu forma de
 * pagamento nenhuma: ela manda cartão a vista só porque a rota exige um
 * valor ali. Exibir esses avisos seria responder a uma pergunta que o
 * cliente não fez, sobre uma escolha que ele ainda não teve. O que saiu das
 * próprias linhas, sim, e dele.
 */

export interface CartNoticesProps {
  unavailable: readonly QuoteLine[];
  pricesChanged: boolean;
  onDismissPrices: () => void;
}

export function CartNotices({ unavailable, pricesChanged, onDismissPrices }: CartNoticesProps) {
  const removeLine = useCart((state) => state.removeLine);

  const removeAll = (): void => {
    for (const item of unavailable) {
      removeLine(item.productId, item.variantId);
    }
  };

  return (
    <>
      {unavailable.length > 0 ? (
        // `aria-live` porque a mudanca chega sozinha, depois de a página já
        // estar aberta: o produto desativado no painel aparece aqui na
        // cotação seguinte, sem ninguém ter clicado em nada. Educado, e não
        // assertivo — o bloco esta em tela, e interromper a leitura de quem
        // esta conferindo a sacola seria pior do que esperar a pausa.
        <div className={styles.changed} aria-live="polite">
          <p className={styles.title}>
            {unavailable.length === 1
              ? 'Um item saiu da sacola'
              : `${String(unavailable.length)} itens saíram da sacola`}
          </p>

          <ul className={styles.list}>
            {unavailable.map((item) => (
              <li key={`${item.productId}:${item.variantId}`}>
                <strong>{item.productName === '' ? 'Um item' : item.productName}</strong>
                {item.variantLabel === '' ? '' : ` · ${item.variantLabel}`}:{' '}
                {item.unavailableReason}
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            Eles continuam na lista abaixo, fora do total, para você conferir antes de tirar.
          </p>

          <button type="button" className={styles.action} onClick={removeAll}>
            {unavailable.length === 1 ? 'Remover o item' : 'Remover todos'}
          </button>
        </div>
      ) : null}

      {pricesChanged ? (
        <p className={styles.prices} aria-live="polite">
          <span>Os valores foram atualizados desde a sua última visita.</span>

          <button
            type="button"
            className={styles.dismiss}
            onClick={onDismissPrices}
            aria-label="Dispensar o aviso de valores atualizados"
          >
            Entendi
          </button>
        </p>
      ) : null}
    </>
  );
}
