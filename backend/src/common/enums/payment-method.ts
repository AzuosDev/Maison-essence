/**
 * Forma de pagamento informada no pedido. Nenhum pagamento e processado pelo
 * sistema: o valor serve para montar a mensagem do WhatsApp e o parcelamento.
 */
export const PAYMENT_METHODS = {
  PIX: 'pix',
  CARD: 'card',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = Object.values(PAYMENT_METHODS);

/** Tipo da chave PIX. A rota publica expoe o tipo, nunca a chave inteira. */
export const PIX_KEY_TYPES = {
  CPF: 'cpf',
  CNPJ: 'cnpj',
  EMAIL: 'email',
  PHONE: 'phone',
  RANDOM: 'random',
} as const;

export type PixKeyType = (typeof PIX_KEY_TYPES)[keyof typeof PIX_KEY_TYPES];

export const PIX_KEY_TYPE_VALUES: readonly PixKeyType[] = Object.values(PIX_KEY_TYPES);
