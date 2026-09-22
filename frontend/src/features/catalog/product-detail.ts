import type { PublicProductDetail, PublicVariant, QuantityDiscountTier } from './catalog.types';

/**
 * As contas da pagina do produto, fora do React.
 *
 * Sao as regras que decidem o que a tela mostra — qual variante abre
 * selecionada, quais fotos entram na galeria, ate quanto o cliente pode
 * levar e quanto ele economiza levando mais. Nenhuma delas precisa de DOM
 * nem de rede, e todas sao do tipo que se erra em silencio: um teto de
 * quantidade errado so aparece na recusa do pedido, e um desconto calculado
 * de um jeito aqui e de outro no servidor vira discussao na hora de cobrar.
 *
 * Por isso ficam aqui, testadas uma a uma, e o componente so as chama.
 */

/* ---- A variante --------------------------------------------------------- */

/**
 * A variante que a pagina abre selecionada: a mais barata **entre as
 * disponiveis**.
 *
 * Nao e a `displayVariant` do card, que e a mais barata de todas: o card
 * anuncia preco, e "a partir de R$ 180" precisa falar do menor preco exista
 * ele ou nao em estoque. Aqui o cliente vai comprar — abrir a pagina com uma
 * opcao esgotada em foco deixaria o botao desabilitado sem ele ter feito
 * nada.
 *
 * Quando nenhuma esta disponivel, volta a mais barata mesmo assim: a pagina
 * continua precificando o produto e mostrando o botao esgotado, que e o que
 * conta ao cliente que ele existe e voltara.
 */
export function defaultVariant(product: PublicProductDetail): PublicVariant | null {
  return cheapest(product.variants.filter((variant) => variant.isAvailable)) ?? cheapest(product.variants);
}

/**
 * A variante pedida pela URL, se ela existir neste produto.
 *
 * `null` quando o id nao casa com nada — link antigo de uma variante que a
 * dona removeu. A pagina cai na variante padrao em vez de mostrar um produto
 * sem preco.
 */
export function variantById(
  product: PublicProductDetail,
  variantId: string,
): PublicVariant | null {
  if (variantId === '') {
    return null;
  }

  return product.variants.find((variant) => variant.id === variantId) ?? null;
}

function cheapest(variants: readonly PublicVariant[]): PublicVariant | null {
  return variants.reduce<PublicVariant | null>(
    (best, variant) => (best === null || variant.priceCents < best.priceCents ? variant : best),
    null,
  );
}

/* ---- A galeria ---------------------------------------------------------- */

/**
 * As fotos da galeria: as do produto, mais as das variantes que nao estao
 * entre elas.
 *
 * A ordem importa — a capa e a primeira foto do produto, que e a que a dona
 * escolheu para ser a capa. As fotos de variante entram depois, e so as que
 * ainda nao apareceram: e comum a dona usar a mesma foto no produto e na
 * variante de 100ml, e duplicar isso na faixa de miniaturas faria o cliente
 * achar que ha duas fotos iguais por engano.
 *
 * A lista pode voltar vazia, e o componente desenha o marcador de "sem foto".
 */
export function galleryOf(product: PublicProductDetail): string[] {
  const images: string[] = [];

  for (const publicId of [...product.images, ...product.variants.map((variant) => variant.image)]) {
    if (publicId !== '' && !images.includes(publicId)) {
      images.push(publicId);
    }
  }

  return images;
}

/**
 * A foto que a variante escolhida manda mostrar, pelo indice na galeria.
 *
 * `null` quando a variante nao tem foto propria — e ai a galeria fica onde
 * estava. Trocar de 50ml para 100ml num produto fotografado uma vez so nao
 * deve jogar o cliente de volta para a primeira foto enquanto ele olhava a
 * terceira.
 */
export function imageIndexOf(gallery: readonly string[], variant: PublicVariant | null): number | null {
  if (variant === null || variant.image === '') {
    return null;
  }

  const index = gallery.indexOf(variant.image);

  return index === -1 ? null : index;
}

/* ---- A quantidade ------------------------------------------------------- */

/** Estoque daqui para baixo, a tela avisa que esta acabando. */
export const LOW_STOCK_THRESHOLD = 3;

/**
 * Teto de quantidade de um produto sob encomenda.
 *
 * Nao ha estoque contra o que limitar — a dona vende o que ainda vai buscar
 * — e um campo sem teto nenhum convida ao "999" digitado sem querer. Dez e o
 * ponto em que uma compra de loja de bairro vira uma conversa por WhatsApp,
 * que e como ela deve ser tratada mesmo.
 */
export const ON_DEMAND_MAX_QUANTITY = 10;

/** Ate quanto o seletor deixa subir. Zero quando nao ha o que vender. */
export function maxQuantityOf(variant: PublicVariant | null): number {
  if (variant === null || !variant.isAvailable) {
    return 0;
  }

  return variant.onDemand ? ON_DEMAND_MAX_QUANTITY : Math.min(variant.stock, ON_DEMAND_MAX_QUANTITY);
}

/** "Restam apenas 2": verdade so quando ha estoque contado e ele esta baixo. */
export function isLowStock(variant: PublicVariant | null): boolean {
  return (
    variant !== null && !variant.onDemand && variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD
  );
}

/* ---- O desconto progressivo --------------------------------------------- */

/**
 * O degrau que vale para uma quantidade: o ultimo cujo minimo ela alcanca.
 *
 * Copia fiel de `products/quantity-discount.ts` no backend, e a fidelidade e
 * o ponto — o "leve 3 e ganhe 10%" que a pagina promete e o desconto que
 * `POST /cart/quote` vai aplicar. Nenhum degrau se soma a outro.
 */
export function tierFor(
  ladder: readonly QuantityDiscountTier[],
  quantity: number,
): QuantityDiscountTier | null {
  let best: QuantityDiscountTier | null = null;

  for (const tier of ladder) {
    if (quantity < tier.minQty) {
      break;
    }

    best = tier;
  }

  return best;
}

/** O proximo degrau, para a chamada "leve mais 1 e ganhe 10%". */
export function nextTierFor(
  ladder: readonly QuantityDiscountTier[],
  quantity: number,
): QuantityDiscountTier | null {
  return ladder.find((tier) => tier.minQty > quantity) ?? null;
}

export interface LinePricing {
  /** O desconto que vale agora, em pontos percentuais. */
  percentOff: number;
  /** Quantidade vezes preco, antes do desconto. */
  grossCents: number;
  /** Quanto o desconto tira do total. */
  savingsCents: number;
  /** O que o cliente paga pelo conjunto. */
  totalCents: number;
}

/**
 * O que a quantidade escolhida custa, com o degrau que ela alcanca.
 *
 * `Math.round` sobre o total bruto da linha, e nao sobre o preco unitario: e
 * assim que `cart-lines.ts` faz no servidor, e arredondar por unidade daria
 * um centavo de diferenca em quantidades impares. A cotacao e quem manda —
 * esta conta existe para que o numero da tela seja o mesmo que ela vai
 * devolver, e nao para substitui-la.
 */
export function linePricing(
  unitPriceCents: number,
  quantity: number,
  ladder: readonly QuantityDiscountTier[],
): LinePricing {
  const grossCents = unitPriceCents * quantity;
  const percentOff = tierFor(ladder, quantity)?.percentOff ?? 0;
  const savingsCents = Math.round((grossCents * percentOff) / 100);

  return { percentOff, grossCents, savingsCents, totalCents: grossCents - savingsCents };
}
