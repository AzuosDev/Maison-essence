/**
 * O que o checkout guarda enquanto o cliente atravessa as quatro etapas.
 *
 * Vale aqui a mesma regra da sacola, e pela mesma razao: **nao ha dinheiro
 * neste arquivo.** O que o cliente escolheu — retirar ou receber, em qual
 * cidade, no PIX ou no cartao, em quantas vezes — e escolha, e escolha
 * atravessa o `localStorage` sem risco. Quanto isso custa e pergunta para
 * `POST /cart/quote`, refeita a cada mudanca de qualquer um destes campos.
 *
 * Um total guardado aqui sobreviveria ao reajuste de preco, a promocao que
 * terminou e a taxa de entrega que a dona mudou ontem — e voltaria na tela
 * de quem deixou o checkout aberto durante a noite. Sem o campo, esse bug
 * nao tem onde nascer.
 */

/**
 * As quatro etapas, na ordem em que acontecem.
 *
 * A ordem do array e a ordem do fluxo: e dela que saem o "passo 2 de 4", o
 * proximo e o anterior. Nao ha indice escrito a mao em lugar nenhum.
 */
export const CHECKOUT_STEPS = ['items', 'fulfillment', 'payment', 'review'] as const;

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

/** O nome de cada etapa, para a trilha e para o cabecalho do passo. */
export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  items: 'Itens',
  fulfillment: 'Entrega',
  payment: 'Pagamento',
  review: 'Dados e revisao',
};

export const FULFILLMENT_MODES = {
  DELIVERY: 'DELIVERY',
  PICKUP: 'PICKUP',
} as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[keyof typeof FULFILLMENT_MODES];

export const PAYMENT_METHODS = {
  PIX: 'PIX',
  CARD: 'CARD',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * Para onde entregar. Cinco campos, e nenhum deles e o CEP.
 *
 * A ausencia e deliberada e esta no enunciado da loja: a taxa sai da cidade
 * escolhida numa lista fechada, e nao de faixa de CEP. Pedir o numero
 * significaria coletar um dado que nao entra em conta nenhuma, atrasar o
 * formulario com uma busca de endereco e criar a expectativa de que o frete
 * sera calculado a partir dele.
 *
 * O **ponto de referencia** tem campo proprio pelo motivo inverso: e ele que
 * acha a casa em cidade do interior, e espremido dentro do complemento ele
 * se perde. Os nomes sao os que `POST /orders` recebe, um a um, para que nao
 * exista traducao entre o formulario e o corpo do pedido.
 */
export interface CheckoutAddress {
  street: string;
  /** Opcional no servidor: endereco sem numero existe, e "s/n" e resposta. */
  number: string;
  complement: string;
  district: string;
  reference: string;
}

export const EMPTY_ADDRESS: CheckoutAddress = {
  street: '',
  number: '',
  complement: '',
  district: '',
  reference: '',
};

/**
 * Quem esta comprando.
 *
 * Nome e WhatsApp, e nada mais: a loja fecha a conversa no WhatsApp, e o
 * e-mail seria um campo a mais entre o cliente e o botao de finalizar. O
 * telefone fica aqui **como foi digitado**, com mascara; quem o normaliza
 * para os onze digitos que a API guarda e `normalizePhone`, no momento do
 * envio.
 */
export interface CheckoutContact {
  name: string;
  phone: string;
}

export const EMPTY_CONTACT: CheckoutContact = { name: '', phone: '' };

/** A posicao de uma etapa na trilha: `1` a `4`. */
export function stepNumber(step: CheckoutStep): number {
  return CHECKOUT_STEPS.indexOf(step) + 1;
}

/**
 * A etapa seguinte, ou a propria quando ja e a ultima.
 *
 * O `??` cobre as duas pontas sem `Math.min`: fora da lista, o indice nao
 * casa com nada e a resposta e a etapa recebida.
 */
export function nextStep(step: CheckoutStep): CheckoutStep {
  return CHECKOUT_STEPS[CHECKOUT_STEPS.indexOf(step) + 1] ?? step;
}

/** A etapa anterior, ou a propria quando ja e a primeira. */
export function previousStep(step: CheckoutStep): CheckoutStep {
  return CHECKOUT_STEPS[CHECKOUT_STEPS.indexOf(step) - 1] ?? step;
}
