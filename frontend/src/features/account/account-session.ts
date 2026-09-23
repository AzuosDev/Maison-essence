import type { QueryClient } from '@tanstack/react-query';
import { useCustomerSession } from '@/features/auth';
import { accountKeys } from './account.keys';

/**
 * O cache da conta acompanha quem esta logado.
 *
 * ## O caso que isto evita
 *
 * O navegador de casa e compartilhado. A irma sai da conta, a outra entra, e
 * o TanStack Query — que nao sabe de sessao — serve a lista de pedidos que
 * ja tinha em maos enquanto a consulta nova viaja. Por um segundo, a segunda
 * pessoa le os pedidos da primeira.
 *
 * Um segundo basta. Entao a troca de sessao **remove** tudo debaixo de
 * `['account']`, em vez de invalidar: invalidar mantem o dado antigo em cena
 * ate a resposta nova chegar, que e exatamente o comportamento errado aqui.
 * O catalogo, que e publico e esta na mesma aba, nao e tocado.
 *
 * ## Por que uma assinatura, e nao um `onSuccess` no botao de sair
 *
 * Porque a maior parte das saidas nao passa por botao nenhum. O cliente HTTP
 * encerra a sessao sozinho quando a renovacao falha — token vencido, conta
 * desativada, refresh reusado —, e isso acontece longe de qualquer
 * componente. A assinatura pega os dois caminhos com um codigo so.
 */
export function watchAccountCache(client: QueryClient): () => void {
  let previousId = useCustomerSession.getState().user?.id ?? null;

  return useCustomerSession.subscribe((state) => {
    const currentId = state.user?.id ?? null;

    if (currentId === previousId) {
      return;
    }

    previousId = currentId;
    client.removeQueries({ queryKey: accountKeys.all });
  });
}
