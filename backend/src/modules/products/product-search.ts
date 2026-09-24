import type { QueryFilter } from 'mongoose';
import type { Product } from './schemas/product.schema.js';

/**
 * A partir de quantos caracteres vale usar o índice de texto.
 *
 * O índice casa palavras inteiras com stemming em português — "velas" acha
 * "vela" —, mas não casa prefixo: quem digitou "asa" não acharia "Asad". Até
 * dois caracteres a busca cai no regex, que varre a coleção e só faz sentido
 * porque termo tão curto e coisa de quem ainda esta digitando.
 */
export const MIN_TEXT_SEARCH_LENGTH = 3;

/** Uma busca que usa o índice de texto responde ordenada por relevância. */
export function usesTextIndex(term: string): boolean {
  return term.length >= MIN_TEXT_SEARCH_LENGTH;
}

/**
 * Filtro de busca por nome e marca, do painel e da vitrine.
 *
 * Mora fora do service porque as duas pontas fazem a mesma pergunta: a dona
 * procurando o produto para editar e o cliente procurando o que comprar.
 */
export function searchFilter(term: string): QueryFilter<Product> {
  if (usesTextIndex(term)) {
    return { $text: { $search: term } };
  }

  const pattern = new RegExp(escapeRegex(term), 'i');

  return { $or: [{ name: pattern }, { brand: pattern }] };
}

/** Termo de busca e texto do usuário: `R$ 1,00 (novo)` não pode virar regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
