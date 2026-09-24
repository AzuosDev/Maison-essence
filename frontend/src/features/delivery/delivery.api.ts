import { api } from '@/lib/http';
import type { PublicDeliveryCity } from './delivery.types';

/**
 * As cidades atendidas, na ordem que a dona definiu no painel.
 *
 * `scope: null` como o resto da vitrine: quem esta olhando o prazo de entrega
 * antes de comprar ainda não entrou em conta nenhuma.
 */
export function fetchDeliveryCities(signal?: AbortSignal): Promise<PublicDeliveryCity[]> {
  return api.get<PublicDeliveryCity[]>('/delivery-cities', {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
