import { formatCents } from '../../common/money.js';

/** Teto do campo `order` — o mesmo declarado no schema da cidade. */
export const MAX_DELIVERY_CITY_ORDER = 9999;

/** Teto do prazo, igual ao do schema. Tres meses ja e prazo de encomenda. */
export const MAX_ESTIMATED_DAYS = 90;

export const CITY_NOT_FOUND_MESSAGE = 'Cidade de entrega não encontrada.';

export const CITY_TAKEN_MESSAGE =
  'Essa cidade já esta cadastrada. Edite a que existe em vez de criar outra com taxa diferente.';

export const DUPLICATED_IDS_MESSAGE = 'A lista de ordem tem cidades repetidas.';

export const UNKNOWN_IDS_MESSAGE =
  'A lista de ordem cita cidade que não existe. Recarregue a página e tente de novo.';

/**
 * Recusas do calculo da taxa. Sao 422, e nao 404: quem as recebe esta
 * fechando um pedido, e o que falhou foi a escolha da entrega, nao o
 * endereco da requisicao.
 */
export const CITY_REQUIRED_MESSAGE = 'Escolha a cidade de entrega.';

export const CITY_UNAVAILABLE_MESSAGE =
  'Não entregamos mais nessa cidade. Escolha outra cidade ou retire na loja.';

export const PICKUP_DISABLED_MESSAGE =
  'A retirada na loja esta desativada no momento. Escolha a entrega.';

/** Motivo da isencao quando o cliente vem buscar. */
export const PICKUP_REASON = 'Retirada na loja: sem taxa de entrega.';

/** Cidade cuja taxa cadastrada e zero — a loja entrega ali por conta. */
export function freeCityReason(cityName: string): string {
  return `A entrega para ${cityName} e gratuita.`;
}

/** Isencao pela regra da propria cidade. */
export function freeByCityReason(cityName: string, minCents: number): string {
  return `Frete grátis para ${cityName} em pedidos a partir de ${formatCents(minCents)}.`;
}

/** Isencao pela regra global da loja, que vale onde a cidade nao tem a sua. */
export function freeByStoreReason(minCents: number): string {
  return `Frete grátis em pedidos a partir de ${formatCents(minCents)}.`;
}
