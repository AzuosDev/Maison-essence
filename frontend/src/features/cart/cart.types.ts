/**
 * A sacola.
 *
 * Uma regra explica o formato destas linhas, e ela e a razão de este arquivo
 * ser tão curto: **a sacola guarda três campos, e nenhum deles e dinheiro.**
 *
 * `productId`, `variantId` e `quantity` dizem *o que* o cliente quer. Quanto
 * custa e pergunta para `POST /cart/quote`, sempre, a cada mudanca. Não há
 * `unitPriceCents` aqui, e a ausência não e economia de bytes: um preço
 * guardado no `localStorage` sobrevive a reajuste, a promoção que terminou e
 * a produto desativado, e volta dias depois na tela de quem montou a sacola
 * — que lê um valor e paga outro. Sem o campo, esse bug não tem onde nascer.
 *
 * O nome e a foto são outra conversa: não são dinheiro, ninguém paga por
 * eles, e a gaveta precisa deles no instante em que abre. Eles vivem em
 * `CartLineHint`, **em memória**, e morrem ao recarregar a página — quando a
 * cotação passa a ser a única fonte de tudo.
 */

/** Teto por linha, igual ao que a cotação e o pedido aceitam. */
export const MAX_LINE_QUANTITY = 9999;

/** Quantas linhas diferentes a cotação aceita. */
export const MAX_CART_LINES = 50;

/**
 * Uma linha da sacola: o que e guardado, e tudo o que e guardado.
 *
 * O tipo e idêntico ao `QuoteItem` que o servidor recebe, e a igualdade e
 * proposital — a sacola persistida *e* o corpo da cotação. Não há tradução
 * entre os dois, e portanto não há onde um campo a mais entrar sem que
 * alguém note.
 */
export interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * O que a tela desenha enquanto a cotação não respondeu.
 *
 * Nome, opção e foto — nada que se pague. Preenchido por quem adiciona o
 * item, que já tem o produto em mãos, e usado para a gaveta abrir cheia no
 * mesmo quadro do clique, em vez de piscar vazia por 400ms de debounce mais
 * a ida ao servidor.
 *
 * Não e persistido. Quem recarrega a página cai direto no esqueleto e espera
 * a cotação, que e a leitura correta: depois de fechar o navegador, nada do
 * que estava na tela continua valendo.
 */
export interface CartLineHint {
  name: string;
  slug: string;
  /** `100ml`, `Asad Elixir`. Vazio no produto sem variantes. */
  variantLabel: string;
  /** `publicId` do Cloudinary. */
  image: string;
}

/** O identificador de uma linha: produto mais variante. */
export type CartLineKey = `${string}:${string}`;

export function lineKey(productId: string, variantId: string): CartLineKey {
  return `${productId}:${variantId}`;
}

/**
 * A linha como o corpo de `POST /cart/quote` a espera.
 *
 * Alias de `CartLine`, e não uma interface repetida: são o mesmo objeto, e
 * declara-los duas vezes convidaria os dois a divergirem no dia em que
 * alguém acrescentasse um campo a um deles.
 */
export type QuoteItem = CartLine;
