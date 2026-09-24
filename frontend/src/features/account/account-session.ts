import type { QueryClient } from '@tanstack/react-query';
import { useCustomerSession } from '@/features/auth';
import { accountKeys } from './account.keys';

/**
 * O cache da conta acompanha quem esta logado.
 *
 * ## O caso que isto evita
 *
 * O navegador de casa e compartilhado. A irma sai da conta, a outra entra, e
 * o TanStack Query — que não sabe de sessão — serve a lista de pedidos que
 * já tinha em mãos enquanto a consulta nova viaja. Por um segundo, a segunda
 * pessoa lê os pedidos da primeira.
 *
 * Um segundo basta. Então a troca de sessão **remove** tudo debaixo de
 * `['account']`, em vez de invalidar: invalidar mantem o dado antigo em cena
 * até a resposta nova chegar, que e exatamente o comportamento errado aqui.
 * O catálogo, que e público e esta na mesma aba, não e tocado.
 *
 * ## Por que uma assinatura, e não um `onSuccess` no botão de sair
 *
 * Porque a maior parte das saídas não passa por botão nenhum. O cliente HTTP
 * encerra a sessão sozinho quando a renovação falha — token vencido, conta
 * desativada, refresh reusado —, e isso acontece longe de qualquer
 * componente. A assinatura pega os dois caminhos com um código só.
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
