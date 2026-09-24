import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FULFILLMENT_MODES, type FulfillmentMode } from './checkout.types';
import type { CreatedOrder } from './order.types';

/**
 * Os pedidos fechados neste navegador, para a tela de confirmação poder
 * existir.
 *
 * ## Por que guardar, se o pedido esta no servidor
 *
 * Porque não há por onde busca-lo. A API publica cria o pedido em
 * `POST /orders` e não oferece nenhuma rota para lê-lo de volta: quem quiser
 * abrir um pedido pela API precisa de sessão de cliente
 * (`GET /customer/orders/:code`), e o checkout e de convidado por desenho.
 *
 * E acertado que seja assim — um pedido público por código seria adivinhável,
 * e com ele viriam nome, telefone e endereço de quem comprou. O preço dessa
 * decisão e este arquivo: a resposta que o servidor mandou uma vez fica
 * guardada aqui, e `/pedido/:code` lê dela.
 *
 * O efeito prático e o que importa: recarregar a confirmação, voltar para ela
 * pelo botão do navegador ou abrir o endereço de novo no dia seguinte mostra
 * o mesmo pedido, com os mesmos botões de reenviar e copiar.
 *
 * ## O que atravessa o armazenamento
 *
 * Bem menos do que a resposta inteira. São os campos que a tela de
 * confirmação lê, e só eles: o código, a URL e a mensagem do WhatsApp, quem
 * comprou, como recebe, quantos itens e o total.
 *
 * Fica de fora o endereço completo, que a tela não mostra, e a lista de itens
 * com preços, que ela resume. Guardar menos e a regra quando o dado e do
 * cliente e o armazenamento e compartilhado com todo mundo que usa aquele
 * computador — a loja não e uma só, e o celular da família também não.
 *
 * Aqui, diferente da sacola e do checkout, **há dinheiro gravado**: o total.
 * E a exceção que confirma a regra — o pedido esta fechado, o servidor
 * congelou os preços ao grava-lo, e este número nunca mais muda. O que as
 * outras telas evitam e guardar um valor que ainda depende de recálculo.
 *
 * ## Três, e os três mais recentes
 *
 * Uma lista que cresce sem limite acumularia o histórico de compras da pessoa
 * no `localStorage` para sempre. Três cobre o caso real — fechou o pedido,
 * fechou outro para a irma, voltou para conferir o primeiro — e o histórico
 * de verdade e a área do cliente, que lê do servidor.
 */

/** O pedido fechado, reduzido ao que a confirmação mostra. */
export interface PlacedOrder {
  /** `ME-AAMMDD-XXXX`. E o que o cliente repete no WhatsApp. */
  code: string;
  /**
   * A URL pronta do `wa.me`, como o servidor a montou.
   *
   * Guardada inteira, e não remontada a partir da mensagem: o "reenviar"
   * precisa mandar exatamente o mesmo endereço que o envio original mandaria.
   * Vazia quando a loja ainda não cadastrou o número.
   */
  whatsappUrl: string;
  /** O texto sem codificação, para o botão de copiar. */
  whatsappMessage: string;
  customerName: string;
  /** Onze digitos. Preenche o cadastro que a confirmação oferece. */
  customerPhone: string;
  mode: FulfillmentMode;
  /** Vazio na retirada. */
  cityName: string;
  itemCount: number;
  totalCents: number;
  /** ISO, para ordenar e para a tela escrever a data. */
  placedAt: string;
}

/** Quantos pedidos ficam guardados neste navegador. */
export const PLACED_ORDERS_LIMIT = 3;

interface PlacedOrdersState {
  /** Do mais recente para o mais antigo. */
  orders: PlacedOrder[];
  /** Guarda a resposta de `POST /orders`. Chamada uma vez, no sucesso. */
  remember: (created: CreatedOrder) => void;
  /** Esquece tudo. Existe para o logout e para os testes. */
  clear: () => void;
}

export const usePlacedOrders = create<PlacedOrdersState>()(
  persist(
    (set) => ({
      orders: [],

      remember: (created) => {
        const placed = placedOrderFrom(created);

        set((state) => ({
          orders: [placed, ...state.orders.filter((order) => order.code !== placed.code)].slice(
            0,
            PLACED_ORDERS_LIMIT,
          ),
        }));
      },

      clear: () => {
        set({ orders: [] });
      },
    }),
    {
      name: 'maison-essence.placed-orders',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ orders: state.orders }),
    },
  ),
);

/**
 * O seletor da tela de confirmação.
 *
 * Devolve o pedido daquele código, ou `null` quando ele não foi fechado neste
 * navegador — link colado de outro aparelho, histórico limpo, ou o quarto
 * pedido de uma lista que guarda três. A tela trata esse `null` como um
 * estado próprio, e não como erro: o pedido existe, ele só não esta aqui.
 */
export function placedOrderBy(code: string) {
  return (state: PlacedOrdersState): PlacedOrder | null =>
    state.orders.find((order) => order.code === code) ?? null;
}

/**
 * A resposta do servidor, reduzida ao que fica guardado.
 *
 * Nenhum número e recalculado: `totalCents` e o total que o servidor gravou
 * no pedido, e `itemCount` e a soma das quantidades que ele confirmou — não
 * das que estavam na sacola. Depois do `201`, a verdade do pedido e o pedido.
 */
function placedOrderFrom(created: CreatedOrder): PlacedOrder {
  const { order } = created;

  return {
    code: created.code,
    whatsappUrl: created.whatsappUrl,
    whatsappMessage: order.whatsappMessage,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    mode: order.fulfillment.mode,
    cityName: order.fulfillment.mode === FULFILLMENT_MODES.DELIVERY ? order.fulfillment.cityName : '',
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    totalCents: order.totals.totalCents,
    placedAt: order.createdAt,
  };
}
