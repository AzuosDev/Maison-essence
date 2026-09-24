import { useQuery } from '@tanstack/react-query';
import { fetchPaymentSettings } from './payments.api';
import { paymentKeys } from './payments.keys';
import type { PublicPaymentSettings } from './payments.types';

/**
 * As formas de pagamento, buscadas uma vez por visita.
 *
 * Todo card de produto chama este hook, e uma grade tem vinte deles. Não são
 * vinte requisições: o TanStack Query deduplica pela chave, e as regras de
 * pagamento mudam algumas vezes por ano — dai a meia hora de frescor, que faz
 * a segunda tela da visita nem revalidar.
 *
 * O card desenha sem esperar por isto. A linha de parcelamento tem altura
 * reservada no CSS, então a resposta chegando atrasada preenche um espaço que
 * já existia, em vez de empurrar o botão para baixo.
 */
const STALE_TIME_MS = 30 * 60 * 1000;

export function usePaymentSettings() {
  return useQuery<PublicPaymentSettings>({
    queryKey: paymentKeys.settings(),
    queryFn: ({ signal }) => fetchPaymentSettings(signal),
    staleTime: STALE_TIME_MS,
  });
}
