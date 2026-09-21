import { formatCents } from '../../common/money.js';
import { freeFromCents } from './delivery-fee.js';
import type { DeliveryCityDocument } from './schemas/delivery-city.schema.js';

/** Cidade como o painel a ve: inclusive as desativadas, para a dona reativar. */
export interface DeliveryCityView {
  id: string;
  name: string;
  state: string;
  feeCents: number;
  estimatedDays: number;
  minOrderForFreeCents: number | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cidade como o checkout a recebe.
 *
 * Os valores em centavos continuam ai — quem soma usa eles — e os rotulos sao
 * acrescimo, para que a taxa apareca escrita do mesmo jeito na sacola, no
 * checkout e na mensagem do WhatsApp. Sem eles, cada tela inventa a sua
 * virgula e uma delas erra.
 *
 * `freeFromCents` ja vem com a precedencia resolvida: e o minimo da cidade
 * quando ela tem um, e o da loja quando nao tem. A vitrine nao precisa
 * conhecer a regra, so exibir o numero.
 */
export interface PublicDeliveryCityView {
  id: string;
  name: string;
  state: string;
  feeCents: number;
  /** `R$ 15,00`, ou `Gratis` quando a cidade nao tem taxa. */
  feeLabel: string;
  estimatedDays: number;
  /** `Ate 3 dias uteis`. */
  estimatedLabel: string;
  freeFromCents: number | null;
  /** `Frete gratis a partir de R$ 150,00`. Vazio quando nao ha regra. */
  freeFromLabel: string;
}

export function toDeliveryCityView(city: DeliveryCityDocument): DeliveryCityView {
  return {
    id: city._id.toHexString(),
    name: city.name,
    state: city.state,
    feeCents: city.feeCents,
    estimatedDays: city.estimatedDays,
    minOrderForFreeCents: city.minOrderForFreeCents,
    isActive: city.isActive,
    order: city.order,
    createdAt: city.createdAt,
    updatedAt: city.updatedAt,
  };
}

export function toPublicDeliveryCityView(
  city: DeliveryCityDocument,
  freeShippingMinCents: number | null,
): PublicDeliveryCityView {
  const freeFrom = freeFromCents(city, freeShippingMinCents);

  return {
    id: city._id.toHexString(),
    name: city.name,
    state: city.state,
    feeCents: city.feeCents,
    feeLabel: city.feeCents === 0 ? 'Gratis' : formatCents(city.feeCents),
    estimatedDays: city.estimatedDays,
    estimatedLabel: estimatedLabelOf(city.estimatedDays),
    freeFromCents: freeFrom,
    freeFromLabel: freeFrom === null ? '' : `Frete gratis a partir de ${formatCents(freeFrom)}`,
  };
}

/**
 * O prazo em palavras.
 *
 * "Ate" porque o numero cadastrado e o pior caso, e e assim que o cliente
 * precisa le-lo: prometer "em 3 dias" e criar reclamacao no segundo dia.
 */
export function estimatedLabelOf(days: number): string {
  if (days <= 0) {
    return 'No mesmo dia';
  }

  return days === 1 ? 'Ate 1 dia util' : `Ate ${days} dias uteis`;
}
