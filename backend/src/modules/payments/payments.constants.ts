/**
 * Tetos do painel de pagamento, todos iguais aos declarados no schema.
 *
 * Estao aqui para os DTOs recusarem o valor antes de o documento ser tocado:
 * erro de digitacao na tela deve voltar como 400 com o campo apontado, e nao
 * como 422 vindo do Mongoose depois de meio formulario ja ter sido aplicado.
 */

/** Ninguem parcela mais que isso, e cartao nenhum aceita. */
export const MAX_INSTALLMENTS = 24;

/** Juros ao mes. Fracionario: 1,99 e o valor corrente da maquininha. */
export const MAX_MONTHLY_INTEREST_PERCENT = 20;

/**
 * Teto do desconto do PIX.
 *
 * Metade do pedido ja e absurdo, e o numero existe justamente para o zero a
 * mais nao virar promocao: 50 digitado onde se queria 5 e um erro de dedo,
 * 500 seria a loja pagando o cliente.
 */
export const MAX_PIX_DISCOUNT_PERCENT = 50;

/** Tamanho maximo da chave PIX, igual ao do schema. */
export const MAX_PIX_KEY_LENGTH = 140;
