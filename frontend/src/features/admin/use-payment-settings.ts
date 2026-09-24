import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentKeys } from '@/features/payments';
import { fetchAdminPaymentSettings, updatePaymentSettings } from './admin.api';
import { adminKeys } from './admin.keys';
import type { UpdatePaymentSettingsInput } from './admin.types';

/**
 * As regras de pagamento.
 *
 * ## Documento único, sem lista
 *
 * Não há `useCreate` nem `useDelete`: existe um registro só, e ele nasce com
 * os padrões na primeira leitura. Por isso também não há nada otimista aqui —
 * o que se salva são juros e desconto, e ver um número aparecer e voltar
 * meio segundo depois e o jeito mais rápido de não confiar na tela.
 *
 * ## Por que a resposta entra no cache em vez de invalidar
 *
 * O servidor devolve o documento já normalizado — a chave de telefone volta
 * como `+5588...`, o que foi digitado com parênteses não. Guardar a resposta
 * e o que faz o campo mostrar o que **esta gravado**, e não o que foi
 * enviado; uma invalidação daria no mesmo depois de uma ida a rede a mais.
 *
 * ## A loja também fica velha
 *
 * Mudar o desconto do PIX muda o que a vitrine anuncia. A mesma aba pode
 * estar com a loja aberta em outra guia, e o cache dela e outro (`paymentKeys`,
 * fora da raiz `['admin']`), então ele e invalidado junto.
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
