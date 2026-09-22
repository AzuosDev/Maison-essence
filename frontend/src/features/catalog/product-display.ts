import type { PublicProduct, PublicVariant } from './catalog.types';

/**
 * As contas que o card de produto faz antes de desenhar.
 *
 * Funcoes puras, fora do componente, porque sao regras de vitrine e nao de
 * layout: qual variante o card precifica, qual preco vai riscado e o que
 * acontece quando o cliente aperta "Adicionar". A pagina do produto e a
 * sugestao da busca vao querer as mesmas respostas, e nenhuma delas deveria
 * ter que reler o JSX do card para descobri-las.
 *
 * Nenhuma delas inventa numero: preco, desconto e disponibilidade vem
 * calculados do backend. O que esta aqui e escolha — qual dos valores que ja
 * vieram e o que a tela mostra.
 */

/**
 * A variante que o card precifica: a mais barata.
 *
 * E a mesma que define `priceRangeCents.min`, e por isso o preco em destaque
 * e o preco riscado falam do mesmo produto. Escolher a primeira da lista
 * faria o card anunciar R$ 320 enquanto o selo diz "a partir de R$ 180".
 *
 * `null` quando nao ha variante ativa — produto que ficou sem nenhuma
 * opcao a venda. O card continua desenhando, so nao oferece o botao.
 */
export function displayVariant(product: PublicProduct): PublicVariant | null {
  return product.variants.reduce<PublicVariant | null>(
    (cheapest, variant) =>
      cheapest === null || variant.priceCents < cheapest.priceCents ? variant : cheapest,
    null,
  );
}

/**
 * O preco riscado, ou `null` quando nao ha o que riscar.
 *
 * So aparece quando o produto tem um preco so. Num produto que custa de
 * R$ 180 a R$ 320, riscar R$ 240 ao lado da faixa nao informa nada: o cliente
 * nao sabe a qual das opcoes aquele "de" se refere, e a leitura mais natural
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
 * A unica variante do produto, quando ele so tem uma.
 *
 * E ela que decide o botao do card: com uma opcao so, "Adicionar" poe o item
 * na sacola e acabou; com duas ou mais, abre o seletor. Note que a pergunta
 * nao e o `hasVariants` da API — esse campo e `true` tambem para a variante
 * unica que tem rotulo ("100ml"), e obrigar o cliente a escolher entre uma
 * opcao so e um clique cobrado por nada.
 */
export function soleVariant(product: PublicProduct): PublicVariant | null {
  return product.variants.length === 1 ? (product.variants[0] ?? null) : null;
}

/** "Leve 3 e ganhe 10%", ou `null` quando o produto nao tem escada. */
export function quantityDiscountLabel(product: PublicProduct): string | null {
  const tier = product.quantityDiscount;

  return tier ? `Leve ${tier.minQty} e ganhe ${tier.percentOff}%` : null;
}
