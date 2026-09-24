import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import {
  PICKUP_REASON,
  freeByCityReason,
  freeByStoreReason,
  freeCityReason,
} from './delivery.constants.js';

/**
 * A regra da taxa de entrega, em função pura.
 *
 * Vive longe do Mongoose e longe do HTTP porque e a conta que decide quanto o
 * cliente paga, e uma conta dessas precisa ser testável sem banco: "pedido de
 * R$ 149,99 em cidade com frete grátis a partir de R$ 150" e um caso de
 * centavo, não de integração.
 *
 * Quem chama e o `DeliveryService`, e só ele — o pedido pergunta a taxa, nunca
 * a calcula.
 */

/** O que basta saber de uma cidade para chegar a taxa. */
export interface FeeCity {
  name: string;
  feeCents: number;
  /** Regra própria da cidade. `null` significa "use a da loja". */
  minOrderForFreeCents: number | null;
}

/**
 * O pedido do cálculo.
 *
 * União discriminada pelo modo, e não um objeto com tudo opcional: retirada
 * não tem cidade nem subtotal que importe, e deixar esses campos disponíveis
 * no ramo de retirada seria convidar a usa-los. E a forma do tipo que diz que
 * retirada dispensa endereço.
 */
export type FeeRequest =
  | { mode: typeof FULFILLMENT_MODES.PICKUP }
  | {
      mode: typeof FULFILLMENT_MODES.DELIVERY;
      city: FeeCity;
      subtotalCents: number;
      /** Regra global da loja, de `StoreSettings`. `null` desliga a regra. */
      freeShippingMinCents: number | null;
    };

export interface ResolvedFee {
  feeCents: number;
  isFree: boolean;
  /** Por que não há taxa. Vazio quando há. */
  freeReason: string;
  /**
   * Quanto falta para a entrega sair de graça, em centavos. `null` quando não
   * há regra aplicável ou quando já não há taxa. E o que a sacola exibe como
   * "faltam R$ 30,00 para o frete grátis" — o empurrão que faz o carrinho
   * crescer.
   */
  missingForFreeCents: number | null;
}

/** Sem taxa, com o motivo escrito. */
function free(reason: string): ResolvedFee {
  return { feeCents: 0, isFree: true, freeReason: reason, missingForFreeCents: null };
}

export function resolveDeliveryFee(request: FeeRequest): ResolvedFee {
  if (request.mode === FULFILLMENT_MODES.PICKUP) {
    return free(PICKUP_REASON);
  }

  const { city, subtotalCents, freeShippingMinCents } = request;

  // Taxa zero no cadastro e isenção também, e com motivo próprio: a cidade
  // não ficou de graça por causa do valor do pedido, ela e de graça sempre.
  if (city.feeCents === 0) {
    return free(freeCityReason(city.name));
  }

  /**
   * A regra da cidade tem precedência sobre a global — e precedência, não
   * combinação. Quando a cidade declara um mínimo próprio, ele substitui o da
   * loja inteiro, inclusive se o da loja for mais generoso: cidade distante
   * costuma ter mínimo mais alto justamente para não cair na regra geral, e
   * pegar o menor dos dois anularia essa escolha.
   */
  const minimum = city.minOrderForFreeCents ?? freeShippingMinCents;

  if (minimum === null) {
    return charged(city.feeCents, null);
  }

  if (subtotalCents >= minimum) {
    return free(
      city.minOrderForFreeCents === null
        ? freeByStoreReason(minimum)
        : freeByCityReason(city.name, minimum),
    );
  }

  return charged(city.feeCents, minimum - subtotalCents);
}

function charged(feeCents: number, missingForFreeCents: number | null): ResolvedFee {
  return { feeCents, isFree: false, freeReason: '', missingForFreeCents };
}

/**
 * O mínimo que vale para a cidade, já com a precedência resolvida.
 *
 * A rota publica usa isto para dizer, na lista de cidades, a partir de quanto
 * o frete sai de graça ali — a mesma regra que o cálculo aplica, e não uma
 * segunda copia dela.
 */
export function freeFromCents(
  city: Pick<FeeCity, 'minOrderForFreeCents'>,
  freeShippingMinCents: number | null,
): number | null {
  return city.minOrderForFreeCents ?? freeShippingMinCents;
}
