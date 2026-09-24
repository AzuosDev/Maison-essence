import type { PublicProductDetail, PublicVariant, QuantityDiscountTier } from './catalog.types';

/**
 * As contas da página do produto, fora do React.
 *
 * São as regras que decidem o que a tela mostra — qual variante abre
 * selecionada, quais fotos entram na galeria, até quanto o cliente pode
 * levar e quanto ele economiza levando mais. Nenhuma delas precisa de DOM
 * nem de rede, e todas são do tipo que se erra em silêncio: um teto de
 * quantidade errado só aparece na recusa do pedido, e um desconto calculado
 * de um jeito aqui e de outro no servidor vira discussão na hora de cobrar.
 *
 * Por isso ficam aqui, testadas uma a uma, e o componente só as chama.
 */

/* ---- A variante --------------------------------------------------------- */

/**
 * A variante que a página abre selecionada: a mais barata **entre as
 * disponíveis**.
 *
 * Não e a `displayVariant` do card, que e a mais barata de todas: o card
 * anuncia preço, e "a partir de R$ 180" precisa falar do menor preço exista
 * ele ou não em estoque. Aqui o cliente vai comprar — abrir a página com uma
 * opção esgotada em foco deixaria o botão desabilitado sem ele ter feito
 * nada.
 *
 * Quando nenhuma esta disponível, volta a mais barata mesmo assim: a página
 * continua precificando o produto e mostrando o botão esgotado, que e o que
 * conta ao cliente que ele existe e voltara.
 */
export function defaultVariant(product: PublicProductDetail): PublicVariant | null {
  return cheapest(product.variants.filter((variant) => variant.isAvailable)) ?? cheapest(product.variants);
}

/**
 * A variante pedida pela URL, se ela existir neste produto.
 *
 * `null` quando o id não casa com nada — link antigo de uma variante que a
 * dona removeu. A página cai na variante padrão em vez de mostrar um produto
 * sem preço.
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
 * As fotos da galeria: as do produto, mais as das variantes que não estão
 * entre elas.
 *
 * A ordem importa — a capa e a primeira foto do produto, que e a que a dona
 * escolheu para ser a capa. As fotos de variante entram depois, e só as que
 * ainda não apareceram: e comum a dona usar a mesma foto no produto e na
 * variante de 100ml, e duplicar isso na faixa de miniaturas faria o cliente
 * achar que há duas fotos iguais por engano.
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
 * A foto que a variante escolhida manda mostrar, pelo índice na galeria.
 *
 * `null` quando a variante não tem foto própria — e aí a galeria fica onde
 * estava. Trocar de 50ml para 100ml num produto fotografado uma vez só não
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
 * Não há estoque contra o que limitar — a dona vende o que ainda vai buscar
 * — e um campo sem teto nenhum convida ao "999" digitado sem querer. Dez e o
 * ponto em que uma compra de loja de bairro vira uma conversa por WhatsApp,
 * que e como ela deve ser tratada mesmo.
 */
export const ON_DEMAND_MAX_QUANTITY = 10;

/** Até quanto o seletor deixa subir. Zero quando não há o que vender. */
export function maxQuantityOf(variant: PublicVariant | null): number {
  if (variant === null || !variant.isAvailable) {
    return 0;
  }

  return variant.onDemand ? ON_DEMAND_MAX_QUANTITY : Math.min(variant.stock, ON_DEMAND_MAX_QUANTITY);
}

/** "Restam apenas 2": verdade só quando há estoque contado e ele esta baixo. */
export function isLowStock(variant: PublicVariant | null): boolean {
  return (
    variant !== null && !variant.onDemand && variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD
  );
}

/* ---- O desconto progressivo --------------------------------------------- */

/**
 * O degrau que vale para uma quantidade: o último cujo mínimo ela alcança.
 *
 * Copia fiel de `products/quantity-discount.ts` no backend, e a fidelidade e
 * o ponto — o "leve 3 e ganhe 10%" que a página promete e o desconto que
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

/** O próximo degrau, para a chamada "leve mais 1 e ganhe 10%". */
export function nextTierFor(
  ladder: readonly QuantityDiscountTier[],
  quantity: number,
): QuantityDiscountTier | null {
  return ladder.find((tier) => tier.minQty > quantity) ?? null;
}

export interface LinePricing {
  /** O desconto que vale agora, em pontos percentuais. */
  percentOff: number;
  /** Quantidade vezes preço, antes do desconto. */
  grossCents: number;
  /** Quanto o desconto tira do total. */
  savingsCents: number;
  /** O que o cliente paga pelo conjunto. */
  totalCents: number;
}

/**
 * O que a quantidade escolhida custa, com o degrau que ela alcança.
 *
 * `Math.round` sobre o total bruto da linha, e não sobre o preço unitário: e
 * assim que `cart-lines.ts` faz no servidor, e arredondar por unidade daria
 * um centavo de diferença em quantidades impares. A cotação e quem manda —
 * esta conta existe para que o número da tela seja o mesmo que ela vai
 * devolver, e não para substitui-lá.
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
