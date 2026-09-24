/**
 * Teto do campo `order` — o mesmo declarado no schema.
 *
 * Serve de limite para a lista do reorder: como a rota grava a posicao pelo
 * indice, uma lista maior que isso geraria um `order` que o schema recusa.
 */
export const MAX_CATEGORY_ORDER = 9999;

/**
 * Quantos enderecos antigos guardar por categoria.
 *
 * O link circula no WhatsApp por semanas, nao por anos; depois de dez
 * renomeacoes o primeiro endereco ja nao esta na conversa de ninguem, e a
 * lista para de crescer sem limite dentro do documento.
 */
export const MAX_PREVIOUS_SLUGS = 10;

export const CATEGORY_NOT_FOUND_MESSAGE = 'Categoria não encontrada.';
