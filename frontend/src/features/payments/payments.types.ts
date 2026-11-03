/**
 * As formas de pagamento que a loja aberta anuncia.
 *
 * Espelho de `PublicPaymentSettingsView` do backend. Nenhum pagamento e
 * processado pelo sistema: a dona combina a cobrança pelo WhatsApp. O que
 * esta aqui e o que a vitrine precisa para escrever "em até 3x sem juros" no
 * card e para montar as opções do checkout.
 *
 * Os dois blocos são `null` quando a forma não e aceita, em vez de virem
 * acompanhados de um `acceptsCard: false`. Desligar o cartão no painel faz a
 * opção sumir da resposta, e a tela não tem como exibir por engano um
 * parcelamento que a loja não oferece — não há o que exibir.
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

/**
 * Por onde o cartão vai ser cobrado. Espelho de `CARD_MODES` no backend.
 *
 * As duas taxas são diferentes, e por isso a escolha muda o valor da parcela.
 * Não e uma forma de pagamento a mais: o pedido continua sendo "cartão".
 */
export const CARD_MODES = {
  LINK: 'link',
  TAP: 'tap',
} as const;

export type CardMode = (typeof CARD_MODES)[keyof typeof CARD_MODES];

export const CARD_MODE_VALUES: readonly CardMode[] = Object.values(CARD_MODES);

/** Como cada modalidade se apresenta a quem esta comprando. */
export const CARD_MODE_LABELS: Record<CardMode, string> = {
  link: 'Pelo link de pagamento',
  tap: 'Na maquininha, quando receber',
};

/**
 * A modalidade dentro de uma frase, para o pedido já fechado.
 *
 * "Cartão pelo link em 6x" se lê de uma vez; "Cartão (Pelo link de pagamento)
 * em 6x" e o mesmo dado escrito como formulário. São as mesmas palavras da
 * mensagem do WhatsApp, de propósito: a dona compara as duas telas.
 */
export const CARD_MODE_SHORT: Record<CardMode, string> = {
  link: 'pelo link',
  tap: 'na maquininha',
};

/** A frase curta que explica a escolha, embaixo do rotulo. */
export const CARD_MODE_NOTES: Record<CardMode, string> = {
  link: 'A loja manda o link no WhatsApp e você paga na hora.',
  tap: 'A maquininha vai junto na entrega ou fica na loja, na retirada.',
};

/**
 * O plano da operadora. Espelho de `CARD_PLANS` no backend.
 *
 * Não chega a loja aberta e não aparece no checkout: quando a loja recebe e
 * custo dela, e o que vai ao cliente e o preço, já calculado pela tabela em
 * uso. Vive aqui porque o painel precisa dos dois nomes.
 */
export const CARD_PLANS = {
  STANDARD: 'standard',
  NITRO: 'nitro',
} as const;

export type CardPlan = (typeof CARD_PLANS)[keyof typeof CARD_PLANS];

export const CARD_PLAN_VALUES: readonly CardPlan[] = Object.values(CARD_PLANS);

/** Como cada plano se chama no painel. São os nomes da operadora. */
export const CARD_PLAN_LABELS: Record<CardPlan, string> = {
  standard: 'Padrão',
  nitro: 'Nitro',
};

/** O que cada plano significa no extrato, em uma linha. */
export const CARD_PLAN_NOTES: Record<CardPlan, string> = {
  standard: 'As taxas de sempre, sem antecipação.',
  nitro: 'A venda parcelada cai na conta na hora, e a operadora cobra mais por isso.',
};

/** O que a loja aberta sabe sobre o PIX. A chave nunca vem nesta resposta. */
export interface PublicPix {
  keyType: PixKeyType;
  /** Sem chave configurada, o PIX não pode ser oferecido. */
  hasKey: boolean;
  discountPercent: number;
}

/**
 * As regras de parcelamento no cartão, do jeito que a loja aberta as conhece.
 *
 * A tabela de taxas não esta aqui, e a falta e deliberada: ela e o custo da
 * loja, item por item, e numa rota publica cacheada ficaria disponível para
 * qualquer um em toda visita. A vitrine não precisa dela — anuncia só o
 * parcelamento sem juros, que sai destes três números —, e as parcelas com
 * taxa chegam prontas do servidor, pela cotação.
 */
export interface PublicCard {
  maxInstallments: number;
  /** Até aqui a loja absorve a taxa; acima, ela e repassada. */
  interestFreeUpTo: number;
  /** Opção cuja parcela cai abaixo disto não e oferecida. */
  minInstallmentCents: number;
}

export interface PublicPaymentSettings {
  pix: PublicPix | null;
  card: PublicCard | null;
}
