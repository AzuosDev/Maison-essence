import {
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  type FulfillmentMode,
  type OrderStatus,
} from '@/features/checkout';

/**
 * O pedido escrito para quem comprou.
 *
 * ## Por que não são os mesmos rótulos do painel
 *
 * `features/admin/order-labels.ts` traduz os mesmos seis status, e traduz
 * diferente de propósito. O painel responde "o que **eu**, loja, preciso
 * fazer com este pedido" — por isso "Aguardando contato", que e uma tarefa
 * da dona. A conta responde "o que esta acontecendo com o **meu** pedido", e
 * "aguardando contato" faria o cliente achar que *ele* precisa ligar.
 *
 * Importar o módulo do painel aqui também arrastaria o painel para o pedaço
 * inicial da loja, que e um preço alto por uma tabela de seis linhas.
 *
 * ## Retirada e entrega leem o mesmo status de jeitos diferentes
 *
 * `SHIPPED` e "a caminho" para quem escolheu entrega e "pronto para
 * retirada" para quem vai buscar. `DELIVERED` e "entregue" e "retirado". E o
 * mesmo campo no banco, e o cliente que marcou retirada nunca vai ver uma
 * palavra sobre entrega.
 */

/** O ciclo normal, na ordem em que o pedido anda. `CANCELLED` fica fora. */
export const ORDER_FLOW: readonly OrderStatus[] = [
  ORDER_STATUSES.PENDING_CONTACT,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];

const DELIVERY_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING_CONTACT]: 'Aguardando confirmação',
  [ORDER_STATUSES.CONFIRMED]: 'Confirmado',
  [ORDER_STATUSES.PREPARING]: 'Em preparo',
  [ORDER_STATUSES.SHIPPED]: 'A caminho',
  [ORDER_STATUSES.DELIVERED]: 'Entregue',
  [ORDER_STATUSES.CANCELLED]: 'Cancelado',
};

const PICKUP_LABELS: Record<OrderStatus, string> = {
  ...DELIVERY_LABELS,
  [ORDER_STATUSES.SHIPPED]: 'Pronto para retirada',
  [ORDER_STATUSES.DELIVERED]: 'Retirado',
};

export function statusLabel(status: OrderStatus, mode: FulfillmentMode): string {
  return mode === 'pickup' ? PICKUP_LABELS[status] : DELIVERY_LABELS[status];
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
  if (status === ORDER_STATUSES.PENDING_CONTACT) {
    return 'gold';
  }

  if (status === ORDER_STATUSES.DELIVERED) {
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
    [FULFILLMENT_MODES.DELIVERY]: 'Seu pedido chegou a loja. A confirmação vem pelo WhatsApp.',
    [FULFILLMENT_MODES.PICKUP]: 'Seu pedido chegou a loja. A confirmação vem pelo WhatsApp.',
  },
  [ORDER_STATUSES.CONFIRMED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'A loja confirmou os itens e o valor.',
    [FULFILLMENT_MODES.PICKUP]: 'A loja confirmou os itens e o valor.',
  },
  [ORDER_STATUSES.PREPARING]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Seu pedido esta sendo separado e embalado.',
    [FULFILLMENT_MODES.PICKUP]: 'Seu pedido esta sendo separado e embalado.',
  },
  [ORDER_STATUSES.SHIPPED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Saiu para o endereço de entrega.',
    [FULFILLMENT_MODES.PICKUP]: 'Já pode ser retirado na loja.',
  },
  [ORDER_STATUSES.DELIVERED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Entregue. Qualquer coisa, e só chamar no WhatsApp.',
    [FULFILLMENT_MODES.PICKUP]: 'Retirado. Qualquer coisa, e só chamar no WhatsApp.',
  },
  [ORDER_STATUSES.CANCELLED]: {
    [FULFILLMENT_MODES.DELIVERY]: 'Este pedido foi cancelado. A loja explica o motivo na conversa.',
    [FULFILLMENT_MODES.PICKUP]: 'Este pedido foi cancelado. A loja explica o motivo na conversa.',
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
 * - Os passos do meio aparecem cumpridos e **sem data**. Um pedido entregue
 *   passou por confirmado e por em preparo; dizer *quando* exigiria inventar
 *   um número, e uma data errada num histórico e pior do que nenhuma.
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
    label: statusLabel(stepStatus, mode),
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

  const current = ORDER_FLOW.indexOf(status);

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
