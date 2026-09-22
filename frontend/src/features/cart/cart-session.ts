import { useCustomerSession } from '@/features/auth';
import { clearStashedCart, readStashedCart, writeStashedCart } from './cart-merge';
import { useCart } from './cart.store';
import { forgetPrices } from './price-watch';

/**
 * A sacola segue quem esta logado.
 *
 * Duas transicoes, e as duas sao a mesma ideia vista de lados opostos.
 *
 * **Entrou.** A sacola desta visita — montada sem se identificar, que e como
 * quase toda compra comeca — recebe o que este cliente tinha deixado neste
 * navegador. As quantidades somam, as linhas nao duplicam, e o que ele
 * acabou de escolher continua na tela. Ninguem perde nada.
 *
 * **Saiu.** A sacola e guardada sob o id dele e a tela fica limpa. Sao duas
 * razoes, e a segunda e a que decide: um navegador de casa e compartilhado,
 * e a proxima pessoa a abrir a loja nao deve encontrar a sacola de quem
 * saiu. A primeira e mais simples — sem isto, o login nunca teria com o que
 * mesclar, e a mescla acima seria uma funcao que nunca roda.
 *
 * ## Por que nao ha sacola no servidor
 *
 * Porque a API nao tem uma. `POST /cart/quote` e a unica rota de carrinho e
 * ela nao grava nada: nao existe colecao, nao existe `GET /cart`. A sacola
 * mora no navegador, e "o carrinho que ja existia" e o que este mesmo
 * navegador guardou quando o cliente saiu. No dia em que a API tiver uma
 * sacola por conta, e esta funcao que muda — e so ela.
 *
 * ## Onde isto e ligado
 *
 * Em `app/providers.tsx`, no escopo do modulo, junto do registro das
 * sessoes. Nao num efeito: a troca de sessao pode acontecer antes de
 * qualquer componente montar — o cliente HTTP encerra a sessao sozinho
 * quando a renovacao falha —, e uma assinatura que so comeca depois do
 * primeiro render perderia justamente esse caso.
 */
export function watchCustomerCart(): () => void {
  let previousId = useCustomerSession.getState().user?.id ?? null;

  return useCustomerSession.subscribe((state) => {
    const currentId = state.user?.id ?? null;

    if (currentId === previousId) {
      return;
    }

    const cart = useCart.getState();

    if (currentId !== null) {
      cart.mergeLines(readStashedCart(currentId));

      // A guardada foi absorvida: mante-la duplicaria a sacola no proximo
      // login, somando tudo outra vez.
      clearStashedCart(currentId);
    } else if (previousId !== null) {
      writeStashedCart(previousId, useCart.getState().lines);
      cart.clear();

      // A anotacao de precos e da sacola que acabou de sair. Deixa-la para
      // tras faria a proxima pessoa receber "os valores foram atualizados"
      // sobre itens que ela nunca viu.
      forgetPrices();
    }

    previousId = currentId;
  });
}
