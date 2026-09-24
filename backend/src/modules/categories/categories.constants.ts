/**
 * Teto do campo `order` — o mesmo declarado no schema.
 *
 * Serve de limite para a lista do reorder: como a rota grava a posição pelo
 * índice, uma lista maior que isso geraria um `order` que o schema recusa.
 */
export const MAX_CATEGORY_ORDER = 9999;

/**
 * Quantos endereços antigos guardar por categoria.
 *
 * O link circula no WhatsApp por semanas, não por anos; depois de dez
 * renomeações o primeiro endereço já não esta na conversa de ninguém, e a
 * lista para de crescer sem limite dentro do documento.
 */
export const MAX_PREVIOUS_SLUGS = 10;

export const CATEGORY_NOT_FOUND_MESSAGE = 'Categoria não encontrada.';
