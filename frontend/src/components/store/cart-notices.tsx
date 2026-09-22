import { useCart, type QuoteLine } from '@/features/cart';
import styles from './cart-notices.module.css';

/**
 * O que mudou na sacola desde a ultima vez que o cliente olhou.
 *
 * Dois avisos, com pesos deliberadamente diferentes.
 *
 * ## O que saiu, em destaque
 *
 * Produto desativado, opcao encerrada, estoque que acabou. Isso muda o que o
 * cliente vai levar e quanto vai pagar, entao aparece antes da lista, com
 * fundo proprio, dizendo **quais** itens sairam e **por que** — nas palavras
 * que o servidor escreveu, que sao as mesmas que o checkout usaria. Um
 * "alguns itens estao indisponiveis" generico obrigaria a varrer a lista
 * inteira procurando quais.
 *
 * O botao remove todos de uma vez. E o que quase todo mundo quer fazer, e
 * fazer item a item numa sacola de oito e trabalho que a tela pode poupar.
 * Cada linha continua com o seu proprio "Remover", para quem quer escolher.
 *
 * ## O reajuste, discreto
 *
 * "Os valores foram atualizados" nao pede acao nenhuma: o preco em tela ja e
 * o novo, ja foi calculado pelo servidor e ja esta somado. O aviso existe
 * porque quem montou a sacola ha uma semana lembra do numero antigo, e
 * descobrir a diferenca sozinho, no checkout, e pior do que ler uma linha
 * aqui. Por isso e uma linha — e dispensavel, porque quem leu nao precisa
 * dela de novo.
 *
 * ## Por que nao os `warnings` da cotacao
 *
 * A resposta traz uma lista pronta, e a sacola nao a usa. Ela mistura
 * recados de item com recados de pagamento e de parcelamento — "a loja nao
 * esta aceitando cartao", por exemplo —, e a sacola nao escolheu forma de
 * pagamento nenhuma: ela manda cartao a vista so porque a rota exige um
 * valor ali. Exibir esses avisos seria responder a uma pergunta que o
 * cliente nao fez, sobre uma escolha que ele ainda nao teve. O que saiu das
 * proprias linhas, sim, e dele.
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
        // `aria-live` porque a mudanca chega sozinha, depois de a pagina ja
        // estar aberta: o produto desativado no painel aparece aqui na
        // cotacao seguinte, sem ninguem ter clicado em nada. Educado, e nao
        // assertivo — o bloco esta em tela, e interromper a leitura de quem
        // esta conferindo a sacola seria pior do que esperar a pausa.
        <div className={styles.changed} aria-live="polite">
          <p className={styles.title}>
            {unavailable.length === 1
              ? 'Um item saiu da sacola'
              : `${String(unavailable.length)} itens sairam da sacola`}
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
            Eles continuam na lista abaixo, fora do total, para voce conferir antes de tirar.
          </p>

          <button type="button" className={styles.action} onClick={removeAll}>
            {unavailable.length === 1 ? 'Remover o item' : 'Remover todos'}
          </button>
        </div>
      ) : null}

      {pricesChanged ? (
        <p className={styles.prices} aria-live="polite">
          <span>Os valores foram atualizados desde a sua ultima visita.</span>

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
