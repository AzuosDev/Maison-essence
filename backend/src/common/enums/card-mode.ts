/**
 * Como o cartão vai ser cobrado: pelo link de pagamento ou na maquininha, na
 * hora da entrega.
 *
 * A diferença não e técnica, e de preço. A operadora cobra uma taxa para o
 * link — cartão que ela não vê — e outra, menor, para o InfiniteTap, em que o
 * cartão esta na frente da maquininha. São duas tabelas diferentes, e a mesma
 * compra em 6x custa um valor em cada uma.
 *
 * Por que isto não e um terceiro valor em `PAYMENT_METHODS`: o pedido continua
 * sendo "cartão" para todo o resto do sistema — filtros do painel, rótulos,
 * relatórios e a etiqueta do pedido não sabem desta divisão e não precisam
 * saber. Ela existe dentro do cartão, e quem a enxerga e o parcelamento.
 *
 * As duas cabem em todo pedido desta loja: entrega na cidade e retirada são as
 * duas presenciais, então a maquininha sempre esta a mão na hora de entregar e
 * o link sempre funciona. Por isso a escolha e do cliente, e não uma
 * consequência do modo de entrega.
 */
export const CARD_MODES = {
  LINK: 'link',
  TAP: 'tap',
} as const;

export type CardMode = (typeof CARD_MODES)[keyof typeof CARD_MODES];

export const CARD_MODE_VALUES: readonly CardMode[] = Object.values(CARD_MODES);
