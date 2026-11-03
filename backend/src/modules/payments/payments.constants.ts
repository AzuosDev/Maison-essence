/**
 * Tetos do painel de pagamento, todos iguais aos declarados no schema.
 *
 * Estão aqui para os DTOs recusarem o valor antes de o documento ser tocado:
 * erro de digitação na tela deve voltar como 400 com o campo apontado, e não
 * como 422 vindo do Mongoose depois de meio formulário já ter sido aplicado.
 */

/** Ninguém parcela mais que isso, e cartão nenhum aceita. */
export const MAX_INSTALLMENTS = 24;

/**
 * Teto da taxa da maquininha, por parcela.
 *
 * Fracionária, como a operadora a publica: 16,66% e a taxa de 12x no link, e
 * arredondar para 17% muda o total de um pedido de R$ 300 em quase um real.
 *
 * Quarenta por cento não e um limite de negocio — nenhuma tabela chega perto
 * disso. E o mesmo papel do teto do desconto do PIX: pegar o zero a mais antes
 * que ele vire preço. O limite que o cálculo exige de verdade e 100%, onde o
 * repasse dividiria por zero, e por isso nada que chegue perto disso pode ser
 * gravado.
 */
export const MAX_CARD_FEE_PERCENT = 40;

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
