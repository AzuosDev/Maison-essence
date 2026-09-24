import { MAX_API_PAGE_SIZE, PAGE_SIZE } from './catalog.filters';
import type { Paginated, PublicProduct } from './catalog.types';

/**
 * O que a vitrine mostra, montado a partir do que a API devolveu.
 *
 * Duas montagens diferentes moram aqui, e ambas são função pura — recebem
 * páginas e devolvem uma lista. Ficam fora do hook porque e o lugar onde a
 * regra de paginação pode ser lida e testada sem React, sem rede e sem
 * relógio.
 */

export interface ListSlice {
  /** Os produtos visíveis agora. No celular, as páginas acumuladas. */
  products: PublicProduct[];
  totalItems: number;
  totalPages: number;
  /** Há página seguinte para o botão "carregar mais". */
  hasMore: boolean;
  /** A varredura do filtro de desconto bateu no teto — ver `saleSlice`. */
  truncated: boolean;
}

export const EMPTY_SLICE: ListSlice = {
  products: [],
  totalItems: 0,
  totalPages: 0,
  hasMore: false,
  truncated: false,
};

/**
 * As páginas da API viram uma lista só.
 *
 * `accumulate` e o celular: lá o cliente aperta "carregar mais" e a página
 * nova entra embaixo da anterior, então as páginas 1 a N aparecem juntas. No
 * desktop, a paginação e numerada e só a página pedida esta em tela — por
 * isso chega uma página só nesta lista.
 *
 * As totalizações saem da última página carregada, e não da primeira: se a
 * dona publicar um produto entre um "carregar mais" e o seguinte, o número
 * mais novo e o mais próximo da verdade.
 */
export function pagedSlice(pages: readonly Paginated<PublicProduct>[]): ListSlice {
  const last = pages.at(-1);

  if (last === undefined) {
    return EMPTY_SLICE;
  }

  return {
    products: pages.flatMap((page) => page.items),
    totalItems: last.totalItems,
    totalPages: last.totalPages,
    hasMore: last.hasMore,
    truncated: false,
  };
}

/**
 * O recorte do filtro "somente com desconto".
 *
 * Este filtro não existe em `GET /products` (ver `apiParamsFrom`). O que
 * chega aqui e uma varredura única: a página cheia do backend — 48 produtos
 * — já ordenada por maior desconto. Como essa ordem põe toda a promoção na
 * frente, descartar quem tem desconto zero devolve exatamente o conjunto
 * pedido, e a partir dai a paginação e feita aqui mesmo.
 *
 * `truncated` avisa quando os 48 vieram todos com desconto: nesse caso pode
 * haver um quadragesimo nono que a varredura não alcancou, e a tela diz isso
 * em vez de apresentar uma contagem que talvez esteja errada.
 */
export function saleSlice(
  scanned: readonly PublicProduct[],
  page: number,
  accumulate: boolean,
): ListSlice {
  const discounted = scanned.filter((product) => product.discountPercent > 0);
  const totalPages = Math.ceil(discounted.length / PAGE_SIZE);
  const end = page * PAGE_SIZE;

  return {
    products: discounted.slice(accumulate ? 0 : (page - 1) * PAGE_SIZE, end),
    totalItems: discounted.length,
    totalPages,
    hasMore: page < totalPages,
    truncated: discounted.length === MAX_API_PAGE_SIZE,
  };
}

/**
 * As marcas presentes numa varredura, sem repetir e em ordem.
 *
 * A comparação ignora caixa porque a marca e texto livre no painel:
 * "Lattafa" e "lattafa" são a mesma prateleira da loja, e apareceriam como
 * duas linhas na lista de filtro. Fica a primeira grafia encontrada.
 */
export function brandsOf(products: readonly PublicProduct[]): string[] {
  const seen = new Map<string, string>();

  for (const { brand } of products) {
    if (brand !== '' && !seen.has(brand.toLowerCase())) {
      seen.set(brand.toLowerCase(), brand);
    }
  }

  return [...seen.values()].toSorted((a, b) => a.localeCompare(b, 'pt'));
}

/**
 * O teto do slider de preço: o maior preço da varredura.
 *
 * A varredura vem ordenada por maior preço, então o primeiro item já e o
 * mais caro — e o teto e exato, e não uma estimativa. O valor sai do `max`
 * da faixa do produto, que e o que um cliente que arrasta o slider até o fim
 * espera alcançar.
 */
export function ceilingOf(products: readonly PublicProduct[]): number {
  return products.reduce((top, product) => Math.max(top, product.priceRangeCents.max), 0);
}
