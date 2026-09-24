/**
 * Tetos do painel de pagamento, todos iguais aos declarados no schema.
 *
 * Estão aqui para os DTOs recusarem o valor antes de o documento ser tocado:
 * erro de digitação na tela deve voltar como 400 com o campo apontado, e não
 * como 422 vindo do Mongoose depois de meio formulário já ter sido aplicado.
 */

/** Ninguém parcela mais que isso, e cartão nenhum aceita. */
export const MAX_INSTALLMENTS = 24;

/** Juros ao mês. Fracionário: 1,99 e o valor corrente da maquininha. */
export const MAX_MONTHLY_INTEREST_PERCENT = 20;

/**
 * Teto do desconto do PIX.
 *
 * Metade do pedido já e absurdo, e o número existe justamente para o zero a
 * mais não virar promoção: 50 digitado onde se queria 5 e um erro de dedo,
 * 500 seria a loja pagando o cliente.
 */
export const MAX_PIX_DISCOUNT_PERCENT = 50;

/** Tamanho máximo da chave PIX, igual ao do schema. */
export const MAX_PIX_KEY_LENGTH = 140;
