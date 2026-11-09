/**
 * A campanha: a faixa da home, a prateleira dela e a vitrine em `/promocao`.
 *
 * O cupom tem dois lados nesta loja, e eles não se misturam. Aqui vive o de
 * fora — o que a campanha **anuncia** —, sem contador, sem teto e sem a lista
 * de produtos. O de dentro, que a dona opera, esta em
 * `features/admin/coupons.ts`. E o que decide se um código vale e quanto ele
 * tira não esta em nenhum dos dois: esta no servidor, em um lugar só.
 */

export { fetchCampaign, fetchLiveCampaign } from './campaign.api';

export { campaignKeys } from './campaign.keys';

export { campaignDeadlineLabel, hasShowcase } from './campaign';

export type { LiveCampaignResponse, PublicCampaign } from './campaign.types';

export {
  CAMPAIGN_SHELF_LIMIT,
  useCampaign,
  useCampaignProducts,
  useLiveCampaign,
} from './use-campaign';
