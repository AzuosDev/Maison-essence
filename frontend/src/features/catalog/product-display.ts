import type { PublicProduct, PublicVariant } from './catalog.types';

/**
 * As contas que o card de produto faz antes de desenhar.
 *
 * Funções puras, fora do componente, porque são regras de vitrine e não de
 * layout: qual variante o card precifica, qual preço vai riscado e o que
 * acontece quando o cliente aperta "Adicionar". A página do produto e a
 * sugestão da busca vão querer as mesmas respostas, e nenhuma delas deveria
 * ter que reler o JSX do card para descobri-las.
 *
 * Nenhuma delas inventa número: preço, desconto e disponibilidade vem
 * calculados do backend. O que esta aqui e escolha — qual dos valores que já
 * vieram e o que a tela mostra.
 */

/**
 * A variante que o card precifica: a mais barata.
 *
 * E a mesma que define `priceRangeCents.min`, e por isso o preço em destaque
 * e o preço riscado falam do mesmo produto. Escolher a primeira da lista
 * faria o card anunciar R$ 320 enquanto o selo diz "a partir de R$ 180".
 *
 * `null` quando não há variante ativa — produto que ficou sem nenhuma
 * opção a venda. O card continua desenhando, só não oferece o botão.
 */
export function displayVariant(product: PublicProduct): PublicVariant | null {
  return product.variants.reduce<PublicVariant | null>(
    (cheapest, variant) =>
      cheapest === null || variant.priceCents < cheapest.priceCents ? variant : cheapest,
    null,
  );
}

/**
 * O preço riscado, ou `null` quando não há o que riscar.
 *
 * Só aparece quando o produto tem um preço só. Num produto que custa de
 * R$ 180 a R$ 320, riscar R$ 240 ao lado da faixa não informa nada: o cliente
 * não sabe a qual das opções aquele "de" se refere, e a leitura mais natural
 * — de que a faixa inteira caiu de R$ 240 — e falsa.
 */
export function compareAtCents(product: PublicProduct): number | null {
  const { min, max } = product.priceRangeCents;

  if (min !== max) {
    return null;
  }

  const variant = displayVariant(product);

  return variant && variant.compareAtPriceCents !== null && variant.compareAtPriceCents > min
    ? variant.compareAtPriceCents
    : null;
}

/**
 * A única variante do produto, quando ele só tem uma.
 *
 * E ela que decide o botão do card: com uma opção só, "Adicionar" põe o item
 * na sacola e acabou; com duas ou mais, abre o seletor. Note que a pergunta
 * não e o `hasVariants` da API — esse campo e `true` também para a variante
 * única que tem rótulo ("100ml"), e obrigar o cliente a escolher entre uma
 * opção só e um clique cobrado por nada.
 */
export function soleVariant(product: PublicProduct): PublicVariant | null {
  return product.variants.length === 1 ? (product.variants[0] ?? null) : null;
}

/** "Leve 3 e ganhe 10%", ou `null` quando o produto não tem escada. */
export function quantityDiscountLabel(product: PublicProduct): string | null {
  const tier = product.quantityDiscount;

  return tier ? `Leve ${tier.minQty} e ganhe ${tier.percentOff}%` : null;
}
