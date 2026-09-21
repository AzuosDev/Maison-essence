import type { QueryFilter } from 'mongoose';
import type { Product } from './schemas/product.schema.js';

/**
 * A partir de quantos caracteres vale usar o indice de texto.
 *
 * O indice casa palavras inteiras com stemming em portugues — "velas" acha
 * "vela" —, mas nao casa prefixo: quem digitou "asa" nao acharia "Asad". Ate
 * dois caracteres a busca cai no regex, que varre a colecao e so faz sentido
 * porque termo tao curto e coisa de quem ainda esta digitando.
 */
export const MIN_TEXT_SEARCH_LENGTH = 3;

/** Uma busca que usa o indice de texto responde ordenada por relevancia. */
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

/** Termo de busca e texto do usuario: `R$ 1,00 (novo)` nao pode virar regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
