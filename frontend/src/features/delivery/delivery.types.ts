/**
 * As cidades que a loja entrega, como a API publica as entrega.
 *
 * Espelho de `PublicDeliveryCityView` do backend. Os rótulos vem prontos do
 * servidor — `R$ 15,00`, `Ate 3 dias uteis` — e a tela usa esses, e não uma
 * formatação própria: a taxa precisa estar escrita igual na página do
 * produto, na sacola, no checkout e na mensagem do WhatsApp. Quatro
 * formatações parecidas viram uma discussão com o cliente na hora de cobrar.
 *
 * Os centavos continuam aí para quem soma.
 */
export interface PublicDeliveryCity {
  id: string;
  name: string;
  state: string;
  feeCents: number;
  /** `R$ 15,00`, ou `Gratis` quando a cidade não tem taxa. */
  feeLabel: string;
  estimatedDays: number;
  /** `Ate 3 dias uteis`. */
  estimatedLabel: string;
  /** Já com a precedência resolvida: o mínimo da cidade, ou o da loja. */
  freeFromCents: number | null;
  /** `Frete gratis a partir de R$ 150,00`. Vazio quando não há regra. */
  freeFromLabel: string;
}
