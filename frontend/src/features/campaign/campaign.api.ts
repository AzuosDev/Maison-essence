import { api } from '@/lib/http';
import type { LiveCampaignResponse, PublicCampaign } from './campaign.types';

/**
 * A campanha que a home anuncia.
 *
 * `scope: null`: a faixa e para quem ainda não se identificou — e e justamente
 * essa pessoa que chegou pelo link do story.
 *
 * Uma só, escolhida pelo servidor: a que termina primeiro entre as que estão
 * no ar com o anúncio ligado, e **que ainda tem cupom**. A última condição e a
 * que impede a home de prometer um código que o fechamento vai recusar.
 */
export function fetchLiveCampaign(signal?: AbortSignal): Promise<LiveCampaignResponse> {
  return api.get<LiveCampaignResponse>('/campaigns/live', {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

/**
 * A campanha de um endereço.
 *
 * `404` quando ela não esta no ar — inclusive a que terminou ontem. O endereço
 * de uma promoção vencida tem que dizer que ela acabou, e não mostrar a vitrine
 * com o desconto que o fechamento já não da.
 */
export function fetchCampaign(slug: string, signal?: AbortSignal): Promise<PublicCampaign> {
  return api.get<PublicCampaign>(`/campaigns/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
