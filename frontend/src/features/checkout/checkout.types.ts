/**
 * O que o checkout guarda enquanto o cliente atravessa as quatro etapas.
 *
 * Vale aqui a mesma regra da sacola, e pela mesma razão: **não há dinheiro
 * neste arquivo.** O que o cliente escolheu — retirar ou receber, em qual
 * cidade, no PIX ou no cartão, em quantas vezes — e escolha, e escolha
 * atravessa o `localStorage` sem risco. Quanto isso custa e pergunta para
 * `POST /cart/quote`, refeita a cada mudanca de qualquer um destes campos.
 *
 * Um total guardado aqui sobreviveria ao reajuste de preço, a promoção que
 * terminou e a taxa de entrega que a dona mudou ontem — e voltaria na tela
 * de quem deixou o checkout aberto durante a noite. Sem o campo, esse bug
 * não tem onde nascer.
 */

/**
 * As quatro etapas, na ordem em que acontecem.
 *
 * A ordem do array e a ordem do fluxo: e dela que saem o "passo 2 de 4", o
 * próximo e o anterior. Não há índice escrito a mão em lugar nenhum.
 */
export const CHECKOUT_STEPS = ['items', 'fulfillment', 'payment', 'review'] as const;

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

/** O nome de cada etapa, para a trilha e para o cabeçalho do passo. */
export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  items: 'Itens',
  fulfillment: 'Entrega',
  payment: 'Pagamento',
  review: 'Dados e revisão',
};

/**
 * Os dois enums que viajam no fio.
 *
 * **Os valores são minusculos porque e assim que o servidor os escreve** —
 * `common/enums/fulfillment-mode.ts` e `payment-method.ts` no backend. A
 * chave em maiúscula e conforto de quem lê o código daqui; o que sai no
 * corpo do `POST /cart/quote` e o valor.
 *
 * Não e detalhe de estilo. O `@IsIn` do DTO compara a string inteira, e
 * `'PICKUP'` volta 400 com "modo de entrega inválido" — a sacola perde o
 * total e o checkout não fecha. Os pedidos já gravados no banco também
 * guardam a forma minúscula, então e este lado que se ajusta, nunca o outro.
 *
 * `wire-contract.spec.ts` compara estes valores com o arquivo do backend.
 */
export const FULFILLMENT_MODES = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
} as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[keyof typeof FULFILLMENT_MODES];

export const PAYMENT_METHODS = {
  PIX: 'pix',
  CARD: 'card',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * Para onde entregar. Cinco campos, e nenhum deles e o CEP.
 *
 * A ausência e deliberada e esta no enunciado da loja: a taxa sai da cidade
 * escolhida numa lista fechada, e não de faixa de CEP. Pedir o número
 * significaria coletar um dado que não entra em conta nenhuma, atrasar o
 * formulário com uma busca de endereço e criar a expectativa de que o frete
 * será calculado a partir dele.
 *
 * O **ponto de referência** tem campo próprio pelo motivo inverso: e ele que
 * acha a casa em cidade do interior, e espremido dentro do complemento ele
 * se perde. Os nomes são os que `POST /orders` recebe, um a um, para que não
 * exista tradução entre o formulário e o corpo do pedido.
 */
export interface CheckoutAddress {
  street: string;
  /** Opcional no servidor: endereço sem número existe, e "s/n" e resposta. */
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
 * e-mail seria um campo a mais entre o cliente e o botão de finalizar. O
 * telefone fica aqui **como foi digitado**, com máscara; quem o normaliza
 * para os onze digitos que a API guarda e `normalizePhone`, no momento do
 * envio.
 */
export interface CheckoutContact {
  name: string;
  phone: string;
}

export const EMPTY_CONTACT: CheckoutContact = { name: '', phone: '' };

/** A posição de uma etapa na trilha: `1` a `4`. */
export function stepNumber(step: CheckoutStep): number {
  return CHECKOUT_STEPS.indexOf(step) + 1;
}

/**
 * A etapa seguinte, ou a própria quando já e a última.
 *
 * O `??` cobre as duas pontas sem `Math.min`: fora da lista, o índice não
 * casa com nada e a resposta e a etapa recebida.
 */
export function nextStep(step: CheckoutStep): CheckoutStep {
  return CHECKOUT_STEPS[CHECKOUT_STEPS.indexOf(step) + 1] ?? step;
}

/** A etapa anterior, ou a própria quando já e a primeira. */
export function previousStep(step: CheckoutStep): CheckoutStep {
  return CHECKOUT_STEPS[CHECKOUT_STEPS.indexOf(step) - 1] ?? step;
}
