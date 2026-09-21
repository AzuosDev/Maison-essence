import { discountLadder, tierFor } from '../products/quantity-discount.js';
import type { QuantityDiscountRule } from '../products/quantity-discount.js';
import {
  MAX_LINE_QUANTITY,
  MERGED_LINES_WARNING,
  PRODUCT_UNAVAILABLE_REASON,
  VARIANT_UNAVAILABLE_REASON,
  cappedQuantityWarning,
  outOfStockReason,
  unavailableWarning,
} from './cart.constants.js';

/**
 * A conta do carrinho, em funcoes puras.
 *
 * Aqui nao entra Mongoose nem HTTP: o que decide quanto o cliente paga
 * precisa ser testavel sem banco, porque os casos que importam sao de centavo
 * e de borda — tres unidades que cruzam o degrau do desconto, a variante que
 * ficou com duas em estoque, a linha repetida que sozinha passaria na
 * conferencia de estoque e somada nao passa.
 *
 * Preco nenhum chega por parametro de fora do catalogo: as funcoes recebem o
 * produto como ele esta no banco e a quantidade pedida, e mais nada. E essa
 * assinatura que torna impossivel um preco do cliente entrar na conta.
 */

/** O que o cliente pede: ids e quantidade. Preco nao faz parte. */
export interface RequestedLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/** A variante como o calculo precisa dela. */
export interface CatalogVariant {
  id: string;
  label: string;
  priceCents: number;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
}

/** O produto como o calculo precisa dele. */
export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  /** Capa do produto, usada quando a variante nao tem foto propria. */
  coverImage: string;
  isActive: boolean;
  categoryIds: readonly string[];
  variants: readonly CatalogVariant[];
}

/**
 * Uma linha cotada.
 *
 * A linha indisponivel volta na resposta, e nao some: quem esta com o item na
 * sacola precisa ver qual deles saiu e por que. Ela vale zero em
 * `lineTotalCents`, e e so isso que a mantem fora das somas.
 */
export interface QuoteItem {
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  image: string;
  quantity: number;
  /** O preco de hoje, lido do banco. */
  unitPriceCents: number;
  /** Quanto ainda ha em estoque, para a sacola ajustar a quantidade. */
  availableStock: number;
  /**
   * Venda sob encomenda: esta linha vale mesmo com o estoque no zero.
   *
   * A sacola usa para avisar do prazo maior; a criacao do pedido usa para
   * saber que esta baixa nao pode exigir estoque suficiente, ou recusaria o
   * proprio item que acabou de cotar como disponivel.
   */
  allowBackorder: boolean;
  /** Desconto por quantidade aplicado a esta linha. */
  discountPercent: number;
  /** Quanto o desconto retirou desta linha, em centavos. */
  discountCents: number;
  /** `unitPriceCents * quantity` menos o desconto. Zero quando indisponivel. */
  lineTotalCents: number;
  unavailable: boolean;
  /** Por que a linha saiu. Vazio quando ela esta valendo. */
  unavailableReason: string;
}

/** O que as linhas disponiveis somam. */
export interface ItemTotals {
  /** Soma das linhas, ja com o desconto por quantidade aplicado. */
  subtotalCents: number;
  /** Quanto o desconto por quantidade retirou no total. */
  discountTotalCents: number;
}

/**
 * Junta as linhas que apontam para a mesma variante.
 *
 * Nao e arrumacao de vitrine: e conferencia de estoque. Duas linhas de tres
 * unidades de uma variante que tem cinco passariam uma a uma, e o pedido
 * sairia com seis. Somadas, a linha unica de seis encontra o estoque de cinco
 * e e recusada, que e a resposta certa. Pelo mesmo motivo o desconto por
 * quantidade so enxerga a quantidade real quando ela esta em um lugar so.
 */
export function mergeLines(items: readonly RequestedLine[]): {
  lines: RequestedLine[];
  warnings: string[];
} {
  const byVariant = new Map<string, RequestedLine>();
  let merged = false;

  for (const item of items) {
    const key = `${item.productId}|${item.variantId}`;
    const current = byVariant.get(key);

    if (current === undefined) {
      byVariant.set(key, { ...item });

      continue;
    }

    merged = true;
    current.quantity += item.quantity;
  }

  const lines = [...byVariant.values()];
  const capped = lines.filter((line) => line.quantity > MAX_LINE_QUANTITY);

  for (const line of capped) {
    line.quantity = MAX_LINE_QUANTITY;
  }

  return {
    lines,
    warnings: [
      ...(merged ? [MERGED_LINES_WARNING] : []),
      ...capped.map(() => cappedQuantityWarning()),
    ],
  };
}

/**
 * Cota cada linha contra o catalogo.
 *
 * Sao duas passagens, e nao uma: a primeira decide quem esta a venda, a
 * segunda aplica o desconto. A ordem importa porque o desconto por quantidade
 * olha para o total de unidades do produto, e uma linha que caiu por falta de
 * estoque nao pode empurrar as outras para o degrau seguinte — seria a sacola
 * anunciar 10% por causa de itens que ninguem vai levar.
 */
export function quoteItems(
  lines: readonly RequestedLine[],
  products: readonly CatalogProduct[],
  rules: readonly QuantityDiscountRule[],
): QuoteItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved = lines.map((line) => {
    const product = byId.get(line.productId) ?? null;

    return { line, product, ...availabilityOf(product, line) };
  });

  /**
   * Unidades por produto, somando as variantes dele.
   *
   * "Leve 3 e ganhe 10%" conta o produto, nao a variante: quem leva um frasco
   * de 100 ml e dois de 50 ml do mesmo perfume levou tres, e recusar o
   * desconto ai seria uma sutileza que ninguem entende olhando a tela.
   */
  const units = new Map<string, number>();

  for (const entry of resolved) {
    if (entry.reason === '') {
      units.set(entry.line.productId, (units.get(entry.line.productId) ?? 0) + entry.line.quantity);
    }
  }

  return resolved.map(({ line, product, variant, reason }) => {
    const available = reason === '';
    const unitPriceCents = variant?.priceCents ?? 0;
    const discountPercent =
      available && product !== null
        ? percentFor(rules, product, units.get(product.id) ?? line.quantity)
        : 0;
    const { discountCents, lineTotalCents } = lineTotalsOf(
      unitPriceCents,
      line.quantity,
      discountPercent,
    );

    return {
      productId: line.productId,
      variantId: line.variantId,
      productName: product?.name ?? '',
      productSlug: product?.slug ?? '',
      variantLabel: variant?.label ?? '',
      image: variant?.image || product?.coverImage || '',
      quantity: line.quantity,
      unitPriceCents,
      availableStock: variant?.stock ?? 0,
      allowBackorder: variant?.allowBackorder ?? false,
      discountPercent,
      discountCents: available ? discountCents : 0,
      lineTotalCents: available ? lineTotalCents : 0,
      unavailable: !available,
      unavailableReason: reason,
    };
  });
}

/**
 * O valor de uma linha: o bruto menos o desconto por quantidade.
 *
 * `Math.round` na virada do centavo, como no desconto do PIX: 10% de R$ 19,99
 * sao R$ 1,999, e o centavo fica com quem paga.
 */
export function lineTotalsOf(
  unitPriceCents: number,
  quantity: number,
  discountPercent: number,
): { discountCents: number; lineTotalCents: number } {
  const grossCents = unitPriceCents * quantity;
  const discountCents = Math.round((grossCents * discountPercent) / 100);

  return { discountCents, lineTotalCents: grossCents - discountCents };
}

/** O que a sacola soma. A linha indisponivel vale zero e nao pesa aqui. */
export function sumItems(items: readonly QuoteItem[]): ItemTotals {
  return items.reduce<ItemTotals>(
    (totals, item) => ({
      subtotalCents: totals.subtotalCents + item.lineTotalCents,
      discountTotalCents: totals.discountTotalCents + item.discountCents,
    }),
    { subtotalCents: 0, discountTotalCents: 0 },
  );
}

/** Um aviso por linha que ficou de fora, com o nome do que saiu. */
export function itemWarnings(items: readonly QuoteItem[]): string[] {
  return items
    .filter((item) => item.unavailable)
    .map((item) => unavailableWarning(item.productName, item.unavailableReason));
}

/**
 * Se a linha esta a venda, e a variante que responde por ela.
 *
 * A variante volta mesmo quando a linha e recusada, desde que exista: e dela
 * que saem o nome da opcao e o estoque restante, e e isso que transforma
 * "indisponivel" em "restam apenas 2" na tela.
 */
function availabilityOf(
  product: CatalogProduct | null,
  line: RequestedLine,
): { variant: CatalogVariant | null; reason: string } {
  if (product === null || !product.isActive) {
    return { variant: null, reason: PRODUCT_UNAVAILABLE_REASON };
  }

  const variant = product.variants.find((candidate) => candidate.id === line.variantId) ?? null;

  if (variant === null || !variant.isActive) {
    return { variant, reason: VARIANT_UNAVAILABLE_REASON };
  }

  // `allowBackorder` e a venda sob encomenda: a dona vende o que ainda vai
  // buscar, e nesses produtos o estoque zerado nao impede nada.
  if (!variant.allowBackorder && variant.stock < line.quantity) {
    return { variant, reason: outOfStockReason(variant.stock) };
  }

  return { variant, reason: '' };
}

/** O desconto que vale para este produto nesta quantidade. Zero quando nenhum vale. */
function percentFor(
  rules: readonly QuantityDiscountRule[],
  product: CatalogProduct,
  quantity: number,
): number {
  return tierFor(discountLadder(rules, product.id, product.categoryIds), quantity)?.percentOff ?? 0;
}
