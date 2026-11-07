import { useQuery } from '@tanstack/react-query';
import { catalogKeys, fetchProducts, type PublicProduct } from '@/features/catalog';
import { fetchCampaign, fetchLiveCampaign } from './campaign.api';
import { campaignKeys } from './campaign.keys';
import type { PublicCampaign } from './campaign.types';

/**
 * A campanha, consultada pela loja aberta.
 *
 * ## A janela de trinta segundos
 *
 * Mais curta que a do catálogo, e a mesma do backend (`SETTINGS_CACHE`), por um
 * motivo só: nesta resposta viaja um número que **se gasta**. O nome e o
 * desconto aguentariam cinco minutos; `scarcityLabel` conta cupons restantes, e
 * "Restam 2" guardado na tela enquanto os dois últimos são vendidos e a loja
 * prometendo o que vai recusar no fechamento.
 *
 * Trinta segundos ainda absorvem a rajada de quem chega por um link de story,
 * que e o tráfego que esta janela existe para segurar.
 *
 * ## Por que a faixa não tem esqueleto
 *
 * Porque a resposta mais comum e "não ha campanha": a loja passa a maior parte
 * do ano sem promoção no ar. Um esqueleto reservando cem pixels abaixo do
 * banner faria a home de todo dia comum abrir com um buraco que depois fecha —
 * o salto de layout que a página inteira foi desenhada para evitar. Sem
 * campanha e sem resposta a faixa não existe, e quando ela chega entra
 * empurrando o que vem abaixo uma vez, e só.
 */
const CAMPAIGN_STALE_TIME_MS = 30_000;

export function useLiveCampaign() {
  return useQuery<PublicCampaign | null>({
    queryKey: campaignKeys.live(),
    queryFn: async ({ signal }) => (await fetchLiveCampaign(signal)).campaign,
    staleTime: CAMPAIGN_STALE_TIME_MS,
  });
}

/**
 * A campanha de um endereço.
 *
 * `retry: false` porque o erro esperado aqui e o `404` — a campanha que
 * acabou, o endereço antigo que alguém guardou no WhatsApp. Tentar de novo
 * três vezes um endereço que não existe só atrasa em dois segundos a tela que
 * explica que a promoção terminou.
 */
export function useCampaign(slug: string | undefined) {
  return useQuery<PublicCampaign>({
    queryKey: campaignKeys.bySlug(slug ?? ''),
    queryFn: ({ signal }) => fetchCampaign(slug ?? '', signal),
    enabled: slug !== undefined && slug !== '',
    staleTime: CAMPAIGN_STALE_TIME_MS,
    retry: false,
  });
}

/** Quantos produtos da campanha a prateleira da home mostra. */
export const CAMPAIGN_SHELF_LIMIT = 12;

/**
 * Os produtos da campanha, para a prateleira da home.
 *
 * Chave de **catálogo**, e não de campanha: isto e uma listagem de produtos
 * com um filtro, e quem salva um perfume no painel precisa derrubá-la junto
 * com o resto da vitrine. E e a mesma chave que a vitrine da campanha usa na
 * primeira página — então quem clica na faixa depois de ver a prateleira
 * encontra a lista já desenhada, sem uma segunda ida ao servidor.
 */
export function useCampaignProducts(slug: string | undefined, limit = CAMPAIGN_SHELF_LIMIT) {
  const params = { campaign: slug ?? '', limit };

  return useQuery<PublicProduct[]>({
    queryKey: catalogKeys.productList(params),
    queryFn: async ({ signal }) => (await fetchProducts(params, signal)).items,
    enabled: slug !== undefined && slug !== '',
    staleTime: CAMPAIGN_STALE_TIME_MS,
  });
}
