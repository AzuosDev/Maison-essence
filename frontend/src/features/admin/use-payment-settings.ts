import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentKeys } from '@/features/payments';
import { fetchAdminPaymentSettings, updatePaymentSettings } from './admin.api';
import { adminKeys } from './admin.keys';
import type { UpdatePaymentSettingsInput } from './admin.types';

/**
 * As regras de pagamento.
 *
 * ## Documento unico, sem lista
 *
 * Nao ha `useCreate` nem `useDelete`: existe um registro so, e ele nasce com
 * os padroes na primeira leitura. Por isso tambem nao ha nada otimista aqui —
 * o que se salva sao juros e desconto, e ver um numero aparecer e voltar
 * meio segundo depois e o jeito mais rapido de nao confiar na tela.
 *
 * ## Por que a resposta entra no cache em vez de invalidar
 *
 * O servidor devolve o documento ja normalizado — a chave de telefone volta
 * como `+5588...`, o que foi digitado com parenteses nao. Guardar a resposta
 * e o que faz o campo mostrar o que **esta gravado**, e nao o que foi
 * enviado; uma invalidacao daria no mesmo depois de uma ida a rede a mais.
 *
 * ## A loja tambem fica velha
 *
 * Mudar o desconto do PIX muda o que a vitrine anuncia. A mesma aba pode
 * estar com a loja aberta em outra guia, e o cache dela e outro (`paymentKeys`,
 * fora da raiz `['admin']`), entao ele e invalidado junto.
 */
const STALE_TIME_MS = 5 * 60_000;

export function useAdminPaymentSettings() {
  return useQuery({
    queryKey: adminKeys.paymentSettings(),
    queryFn: ({ signal }) => fetchAdminPaymentSettings(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useSavePaymentSettings() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePaymentSettingsInput) => updatePaymentSettings(input),

    onSuccess: (saved) => {
      client.setQueryData(adminKeys.paymentSettings(), saved);
      void client.invalidateQueries({ queryKey: paymentKeys.all });
    },
  });
}
