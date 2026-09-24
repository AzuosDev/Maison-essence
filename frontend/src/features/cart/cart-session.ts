import { useCustomerSession } from '@/features/auth';
import { clearStashedCart, readStashedCart, writeStashedCart } from './cart-merge';
import { useCart } from './cart.store';
import { forgetPrices } from './price-watch';

/**
 * A sacola segue quem esta logado.
 *
 * Duas transições, e as duas são a mesma ideia vista de lados opostos.
 *
 * **Entrou.** A sacola desta visita — montada sem se identificar, que e como
 * quase toda compra começa — recebe o que este cliente tinha deixado neste
 * navegador. As quantidades somam, as linhas não duplicam, e o que ele
 * acabou de escolher continua na tela. Ninguém perde nada.
 *
 * **Saiu.** A sacola e guardada sob o id dele e a tela fica limpa. São duas
 * razões, e a segunda e a que decide: um navegador de casa e compartilhado,
 * e a próxima pessoa a abrir a loja não deve encontrar a sacola de quem
 * saiu. A primeira e mais simples — sem isto, o login nunca teria com o que
 * mesclar, e a mescla acima seria uma função que nunca roda.
 *
 * ## Por que não há sacola no servidor
 *
 * Porque a API não tem uma. `POST /cart/quote` e a única rota de carrinho e
 * ela não grava nada: não existe coleção, não existe `GET /cart`. A sacola
 * mora no navegador, e "o carrinho que já existia" e o que este mesmo
 * navegador guardou quando o cliente saiu. No dia em que a API tiver uma
 * sacola por conta, e esta função que muda — e só ela.
 *
 * ## Onde isto e ligado
 *
 * Em `app/providers.tsx`, no escopo do módulo, junto do registro das
 * sessões. Não num efeito: a troca de sessão pode acontecer antes de
 * qualquer componente montar — o cliente HTTP encerra a sessão sozinho
 * quando a renovação falha —, e uma assinatura que só começa depois do
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

      // A guardada foi absorvida: mante-lá duplicaria a sacola no próximo
      // login, somando tudo outra vez.
      clearStashedCart(currentId);
    } else if (previousId !== null) {
      writeStashedCart(previousId, useCart.getState().lines);
      cart.clear();

      // A anotação de preços e da sacola que acabou de sair. Deixa-lá para
      // trás faria a próxima pessoa receber "os valores foram atualizados"
      // sobre itens que ela nunca viu.
      forgetPrices();
    }

    previousId = currentId;
  });
}
