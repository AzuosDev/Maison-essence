import { api } from '@/lib/http';
import type { PublicPaymentSettings } from './payments.types';

/**
 * As formas de pagamento da loja aberta.
 *
 * `scope: null` como todo o resto da vitrine: quem esta olhando o card ainda
 * nao entrou em conta nenhuma. A resposta vem com cinco minutos de cache na
 * borda e `ETag`, entao a revalidacao entre visitas custa um `304` sem corpo.
 */
export function fetchPaymentSettings(signal?: AbortSignal): Promise<PublicPaymentSettings> {
  return api.get<PublicPaymentSettings>('/payment-settings', {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
