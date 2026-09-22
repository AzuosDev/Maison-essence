/**
 * As cidades que a loja entrega, como a API publica as entrega.
 *
 * Espelho de `PublicDeliveryCityView` do backend. Os rotulos vem prontos do
 * servidor — `R$ 15,00`, `Ate 3 dias uteis` — e a tela usa esses, e nao uma
 * formatacao propria: a taxa precisa estar escrita igual na pagina do
 * produto, na sacola, no checkout e na mensagem do WhatsApp. Quatro
 * formatacoes parecidas viram uma discussao com o cliente na hora de cobrar.
 *
 * Os centavos continuam ai para quem soma.
 */
export interface PublicDeliveryCity {
  id: string;
  name: string;
  state: string;
  feeCents: number;
  /** `R$ 15,00`, ou `Gratis` quando a cidade nao tem taxa. */
  feeLabel: string;
  estimatedDays: number;
  /** `Ate 3 dias uteis`. */
  estimatedLabel: string;
  /** Ja com a precedencia resolvida: o minimo da cidade, ou o da loja. */
  freeFromCents: number | null;
  /** `Frete gratis a partir de R$ 150,00`. Vazio quando nao ha regra. */
  freeFromLabel: string;
}
