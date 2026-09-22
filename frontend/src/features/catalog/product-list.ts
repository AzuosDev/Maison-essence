import { MAX_API_PAGE_SIZE, PAGE_SIZE } from './catalog.filters';
import type { Paginated, PublicProduct } from './catalog.types';

/**
 * O que a vitrine mostra, montado a partir do que a API devolveu.
 *
 * Duas montagens diferentes moram aqui, e ambas sao funcao pura — recebem
 * paginas e devolvem uma lista. Ficam fora do hook porque e o lugar onde a
 * regra de paginacao pode ser lida e testada sem React, sem rede e sem
 * relogio.
 */

export interface ListSlice {
  /** Os produtos visiveis agora. No celular, as paginas acumuladas. */
  products: PublicProduct[];
  totalItems: number;
  totalPages: number;
  /** Ha pagina seguinte para o botao "carregar mais". */
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
 * As paginas da API viram uma lista so.
 *
 * `accumulate` e o celular: la o cliente aperta "carregar mais" e a pagina
 * nova entra embaixo da anterior, entao as paginas 1 a N aparecem juntas. No
 * desktop, a paginacao e numerada e so a pagina pedida esta em tela — por
 * isso chega uma pagina so nesta lista.
 *
 * As totalizacoes saem da ultima pagina carregada, e nao da primeira: se a
 * dona publicar um produto entre um "carregar mais" e o seguinte, o numero
 * mais novo e o mais proximo da verdade.
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
 * Este filtro nao existe em `GET /products` (ver `apiParamsFrom`). O que
 * chega aqui e uma varredura unica: a pagina cheia do backend — 48 produtos
 * — ja ordenada por maior desconto. Como essa ordem poe toda a promocao na
 * frente, descartar quem tem desconto zero devolve exatamente o conjunto
 * pedido, e a partir dai a paginacao e feita aqui mesmo.
 *
 * `truncated` avisa quando os 48 vieram todos com desconto: nesse caso pode
 * haver um quadragesimo nono que a varredura nao alcancou, e a tela diz isso
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
 * A comparacao ignora caixa porque a marca e texto livre no painel:
 * "Lattafa" e "lattafa" sao a mesma prateleira da loja, e apareceriam como
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
 * O teto do slider de preco: o maior preco da varredura.
 *
 * A varredura vem ordenada por maior preco, entao o primeiro item ja e o
 * mais caro — e o teto e exato, e nao uma estimativa. O valor sai do `max`
 * da faixa do produto, que e o que um cliente que arrasta o slider ate o fim
 * espera alcancar.
 */
export function ceilingOf(products: readonly PublicProduct[]): number {
  return products.reduce((top, product) => Math.max(top, product.priceRangeCents.max), 0);
}
