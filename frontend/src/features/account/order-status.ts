import {
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  type FulfillmentMode,
  type OrderStatus,
} from '@/features/checkout';

/**
 * O pedido escrito para quem comprou.
 *
 * ## As mesmas palavras do painel, por decisão da dona
 *
 * Os rótulos eram outros aqui — "Aguardando confirmação" no lugar de
 * "Processando", "Pronto para retirada" no lugar de "Saiu para entrega" —,
 * porque o painel responde "o que **eu**, loja, preciso fazer" e a conta
 * responde "o que esta acontecendo com o **meu** pedido". A dona pediu uma
 * palavra só para cada estado, nas duas telas, e e o que esta escrito aqui.
 *
 * Duas consequências que a tela compensa como pode, e que ficam registradas
 * porque não são descuido:
 *
 * - quem marcou **retirada** lê "Saiu para entrega" quando o pedido fica
 *   pronto. A descrição do passo continua falando a língua dele ("já pode
 *   ser retirado na loja"), e e ela que diz o que fazer;
 * - "Vendido" e uma palavra de loja, não de cliente. A descrição do último
 *   passo e que agradece a compra.
 *
 * A tabela continua escrita aqui, e não importada do painel: importar o
 * módulo do painel arrastaria o painel inteiro para o pedaço inicial da
 * loja, que e um preço alto por seis linhas.
 */

/** O ciclo normal, na ordem em que o pedido anda. `CANCELLED` fica fora. */
export const ORDER_FLOW: readonly OrderStatus[] = [
  ORDER_STATUSES.PENDING_CONTACT,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.CONFIRMED,
];

/**
 * Os nomes dos estados, iguais aos do painel.
 *
 * `PREPARING` saiu do ciclo e não aparece na trilha, mas continua traduzido:
 * pode haver pedido antigo parado nele, e um selo sem palavra e pior do que
 * um nome aposentado.
 */
const LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING_CONTACT]: 'Processando',
  [ORDER_STATUSES.SHIPPED]: 'Saiu para entrega',
  [ORDER_STATUSES.DELIVERED]: 'Entregue',
  [ORDER_STATUSES.CONFIRMED]: 'Vendido',
  [ORDER_STATUSES.CANCELLED]: 'Cancelado',
  [ORDER_STATUSES.PREPARING]: 'Processando',
};

export function statusLabel(status: OrderStatus): string {
  return LABELS[status];
}

/**
 * O tom do selo.
 *
 * Quatro tons para seis status, porque o que a cor precisa dizer e mais
 * simples que o estado: **a loja ainda vai responder** (dourado), **esta
 * andando** (tinta), **terminou bem** (verde), **terminou mal** (vermelho).
 * A palavra continua escrita no selo — a cor nunca e o único portador.
 */
export function statusTone(status: OrderStatus): 'gold' | 'ink' | 'success' | 'danger' {
  if (status === ORDER_STATUSES.PENDING_CONTACT || status === ORDER_STATUSES.PREPARING) {
    return 'gold';
  }

  if (status === ORDER_STATUSES.DELIVERED || status === ORDER_STATUSES.CONFIRMED) {
    return 'success';
  }

  return status === ORDER_STATUSES.CANCELLED ? 'danger' : 'ink';
}

/* ---- A trilha do pedido --------------------------------------------------- */

export interface TimelineStep {
  status: OrderStatus;
  label: string;
  /** O que aquele passo significa para quem comprou. */
  description: string;
  state: 'done' | 'current' | 'pending';
  /**
   * Quando aconteceu, em ISO. `null` quando o pedido não guarda essa data.
   *
   * Ver a nota de `orderTimeline`: o passo cumprido sem data aparece
   * cumprido e sem data, e não com uma data inventada a partir da vizinha.
   */
  at: string | null;
}

/* As chaves saem de `FULFILLMENT_MODES`, e não escritas a mão: são valores
   de fio, e escreve-los aqui foi como a tela e o servidor se desencontraram
   uma vez — ver o bloco em `checkout.types.ts`. */
const STEP_DESCRIPTIONS: Record<OrderStatus, Record<FulfillmentMode, string>> = {
  [ORDER_STATUSES.PENDING_CONTACT]: {
    [FULFILLMENT_MODES.DELIVERY]:
      'Seu pedido chegou a loja e esta sendo separado. A confirmação vem pelo WhatsApp.',
    [FULFILLMENT_MODES.PICKUP]:
      'Seu pedido chegou a loja e esta sendo separado. A confirmação vem pelo WhatsApp.',
  },
  [ORDER_STATUSES.SHIPPED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Saiu para o endereço de entrega.',
    [FULFILLMENT_MODES.PICKUP]: 'Já pode ser retirado na loja.',
  },
  [ORDER_STATUSES.DELIVERED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Entregue. Qualquer coisa, é só chamar no WhatsApp.',
    [FULFILLMENT_MODES.PICKUP]: 'Retirado. Qualquer coisa, é só chamar no WhatsApp.',
  },
  // "Vendido" e a palavra da loja para a compra fechada. Para quem comprou,
  // o que importa e que acabou bem — e e isto que a descrição diz.
  [ORDER_STATUSES.CONFIRMED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Compra concluída. Obrigado por comprar com a gente.',
    [FULFILLMENT_MODES.PICKUP]: 'Compra concluída. Obrigado por comprar com a gente.',
  },
  [ORDER_STATUSES.CANCELLED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Este pedido foi cancelado. A loja explica o motivo na conversa.',
    [FULFILLMENT_MODES.PICKUP]: 'Este pedido foi cancelado. A loja explica o motivo na conversa.',
  },
  // Fora da trilha: o ciclo antigo tinha um passo a mais entre a chegada do
  // pedido e a saída para entrega.
  [ORDER_STATUSES.PREPARING]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Seu pedido está sendo separado e embalado.',
    [FULFILLMENT_MODES.PICKUP]: 'Seu pedido está sendo separado e embalado.',
  },
};

/** O pedido, reduzido ao que a trilha precisa saber. */
interface TimelineSource {
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  mode: FulfillmentMode;
}

/**
 * A trilha de status, com as datas que o pedido de fato guarda.
 *
 * ## A parte honesta desta função
 *
 * O pedido grava **duas** datas: `createdAt`, de quando ele nasceu, e
 * `updatedAt`, da última vez que mudou. Não há, no que a API publica, um
 * registro por transição — a mudanca de status e gravada na trilha de
 * auditoria, que e do painel e não tem rota.
 *
 * Então a trilha diz o que sabe e cala o que não sabe:
 *
 * - O primeiro passo leva `createdAt`. E a data em que o pedido foi feito, e
 *   ele nasce sempre neste status.
 * - O passo **atual** leva `updatedAt`, que e quando ele chegou aí.
 * - Os passos do meio aparecem cumpridos e **sem data**. Um pedido vendido
 *   passou por "saiu para entrega" e por "entregue"; dizer *quando* exigiria
 *   inventar um número, e uma data errada num histórico e pior do que
 *   nenhuma.
 * - Os passos seguintes ficam pendentes, apagados, sem data.
 *
 * No dia em que a API publicar as transições, e esta função que muda — e só
 * ela. A tela já desenha `at: null`.
 *
 * ## O cancelamento não e um passo do meio
 *
 * Pedido cancelado não mostra a fila inteira com um X no fim: mostra que foi
 * feito e que foi cancelado. Os passos que ele não chegou a cumprir não
 * pertencem a história dele.
 */
export function orderTimeline(order: TimelineSource): TimelineStep[] {
  const { status, createdAt, updatedAt, mode } = order;

  const step = (
    stepStatus: OrderStatus,
    state: TimelineStep['state'],
    at: string | null,
  ): TimelineStep => ({
    status: stepStatus,
    label: statusLabel(stepStatus),
    description: STEP_DESCRIPTIONS[stepStatus][mode],
    state,
    at,
  });

  if (status === ORDER_STATUSES.CANCELLED) {
    return [
      step(ORDER_STATUSES.PENDING_CONTACT, 'done', createdAt),
      step(ORDER_STATUSES.CANCELLED, 'current', updatedAt),
    ];
  }

  // `PREPARING` saiu do ciclo, e um pedido antigo parado nele não pode cair
  // numa trilha sem passo atual: ele esta, em palavras de hoje, processando.
  const current =
    status === ORDER_STATUSES.PREPARING ? 0 : Math.max(ORDER_FLOW.indexOf(status), 0);

  return ORDER_FLOW.map((flowStatus, index) => {
    if (index === 0) {
      // O pedido nasce aqui: esta data e a única do meio que existe de fato.
      return step(flowStatus, current === 0 ? 'current' : 'done', createdAt);
    }

    if (index < current) {
      return step(flowStatus, 'done', null);
    }

    if (index === current) {
      return step(flowStatus, 'current', updatedAt);
    }

    return step(flowStatus, 'pending', null);
  });
}
