/**
 * A sacola.
 *
 * Duas regras explicam o formato destas linhas.
 *
 * A primeira: o que o servidor precisa para cotar sao tres campos —
 * `productId`, `variantId` e `quantity`. Todo o resto que esta aqui existe
 * para a sacola conseguir se desenhar sem consultar a API a cada abertura.
 *
 * A segunda, que e a que importa: **o preco guardado aqui nao vale**. Ele e
 * uma copia do que o card mostrava na hora em que o item foi adicionado, boa
 * para o resumo lateral e nada mais. Quem diz quanto custa e `POST
 * /cart/quote`, que recalcula preco, desconto progressivo, frete e
 * parcelamento no servidor. Se a dona baixar o preco enquanto o cliente
 * navega, e o do servidor que vale — e essa e a unica leitura que pode virar
 * pedido.
 */

/** Teto por linha, igual ao que a cotacao e o pedido aceitam. */
export const MAX_LINE_QUANTITY = 9999;

/** Quantas linhas diferentes a cotacao aceita. */
export const MAX_CART_LINES = 50;

export interface CartLine {
  /** Os tres campos que a cotacao le. */
  productId: string;
  variantId: string;
  quantity: number;

  /** O resto e copia para a tela — e pode estar desatualizado. */
  name: string;
  slug: string;
  /** `100ml`, `Asad Elixir`. Vazio no produto sem variantes. */
  variantLabel: string;
  /** `publicId` do Cloudinary. */
  image: string;
  /** Preco de referencia, em centavos. A cotacao manda o valor real. */
  unitPriceCents: number;
  /** Estoque visto na hora; `null` quando a venda e sob encomenda. */
  availableStock: number | null;
}

/** O identificador de uma linha: produto mais variante. */
export type CartLineKey = `${string}:${string}`;

export function lineKey(productId: string, variantId: string): CartLineKey {
  return `${productId}:${variantId}`;
}

/** A linha como o corpo de `POST /cart/quote` a espera. */
export interface QuoteItem {
  productId: string;
  variantId: string;
  quantity: number;
}
