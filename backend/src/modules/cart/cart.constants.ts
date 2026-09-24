import { formatCents } from '../../common/money.js';
import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Quantas linhas a cotação aceita.
 *
 * Não e regra de negócio, e teto de custo: cada linha vira busca de produto e
 * conta de desconto, e um corpo com dez mil itens seria um jeito barato de
 * ocupar a função serverless.
 */
export const MAX_QUOTE_ITEMS = 50;

/** Teto de quantidade por linha, o mesmo que o item do pedido aceita. */
export const MAX_LINE_QUANTITY = 9999;

/** Trinta cotações por minuto por IP: recalcular o carrinho e barato, varrer preços não. */
export const QUOTE_RATE_LIMIT: RateLimitRule = {
  scope: 'cart-quote',
  limit: 30,
  windowSeconds: 60,
};

/**
 * Motivos de indisponibilidade, escritos para quem esta comprando.
 *
 * Produto excluído, produto desativado e id inventado dao a mesma frase: para
 * quem esta com o item na sacola, a diferença entre "nunca existiu" e "saiu do
 * catálogo" não muda nada — o que ele precisa saber e que essa linha não vai
 * junto.
 */
export const PRODUCT_UNAVAILABLE_REASON = 'Este produto saiu do catálogo.';

export const VARIANT_UNAVAILABLE_REASON = 'Essa opção não esta mais a venda.';

/** Estoque insuficiente, dizendo quanto ainda da para levar. */
export function outOfStockReason(stock: number): string {
  return stock > 0
    ? `Restam apenas ${stock} unidade${stock === 1 ? '' : 's'} em estoque.`
    : 'Este item esta esgotado.';
}

/** Aviso de linha que ficou de fora do total. */
export function unavailableWarning(name: string, reason: string): string {
  return `${name || 'Um item da sacola'}: ${reason} Ele não entrou no total.`;
}

/** O mesmo produto e a mesma variante chegaram em mais de uma linha. */
export const MERGED_LINES_WARNING =
  'Itens repetidos foram somados em uma linha só.';

/** A soma das linhas repetidas passou do teto por item. */
export function cappedQuantityWarning(): string {
  return `Nenhum item pode passar de ${MAX_LINE_QUANTITY} unidades; a quantidade foi ajustada.`;
}

/** Nenhuma linha sobrou: o total e zero e não há o que fechar. */
export const EMPTY_QUOTE_WARNING =
  'Nenhum item da sacola esta disponível. Revise o carrinho antes de fechar o pedido.';

/** PIX escolhido com a loja sem aceitar PIX. */
export const PIX_UNAVAILABLE_WARNING =
  'A loja não esta aceitando PIX no momento. Escolha outra forma de pagamento.';

/** Cartão escolhido com a loja sem aceitar cartão. */
export const CARD_UNAVAILABLE_WARNING =
  'A loja não esta aceitando cartão no momento. Escolha outra forma de pagamento.';

/** O parcelamento pedido não esta entre os oferecidos para este total. */
export function installmentsUnavailableWarning(requested: number, total: number): string {
  return `${requested}x não esta disponível para um pedido de ${formatCents(total)}.`;
}

/** Parcelamento só existe no cartão; no PIX o pagamento e único. */
export const PIX_HAS_NO_INSTALLMENTS_WARNING = 'O pagamento por PIX e a vista, em uma parcela.';
