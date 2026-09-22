/**
 * A sacola.
 *
 * Uma regra explica o formato destas linhas, e ela e a razao de este arquivo
 * ser tao curto: **a sacola guarda tres campos, e nenhum deles e dinheiro.**
 *
 * `productId`, `variantId` e `quantity` dizem *o que* o cliente quer. Quanto
 * custa e pergunta para `POST /cart/quote`, sempre, a cada mudanca. Nao ha
 * `unitPriceCents` aqui, e a ausencia nao e economia de bytes: um preco
 * guardado no `localStorage` sobrevive a reajuste, a promocao que terminou e
 * a produto desativado, e volta dias depois na tela de quem montou a sacola
 * — que le um valor e paga outro. Sem o campo, esse bug nao tem onde nascer.
 *
 * O nome e a foto sao outra conversa: nao sao dinheiro, ninguem paga por
 * eles, e a gaveta precisa deles no instante em que abre. Eles vivem em
 * `CartLineHint`, **em memoria**, e morrem ao recarregar a pagina — quando a
 * cotacao passa a ser a unica fonte de tudo.
 */

/** Teto por linha, igual ao que a cotacao e o pedido aceitam. */
export const MAX_LINE_QUANTITY = 9999;

/** Quantas linhas diferentes a cotacao aceita. */
export const MAX_CART_LINES = 50;

/**
 * Uma linha da sacola: o que e guardado, e tudo o que e guardado.
 *
 * O tipo e identico ao `QuoteItem` que o servidor recebe, e a igualdade e
 * proposital — a sacola persistida *e* o corpo da cotacao. Nao ha traducao
 * entre os dois, e portanto nao ha onde um campo a mais entrar sem que
 * alguem note.
 */
export interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * O que a tela desenha enquanto a cotacao nao respondeu.
 *
 * Nome, opcao e foto — nada que se pague. Preenchido por quem adiciona o
 * item, que ja tem o produto em maos, e usado para a gaveta abrir cheia no
 * mesmo quadro do clique, em vez de piscar vazia por 400ms de debounce mais
 * a ida ao servidor.
 *
 * Nao e persistido. Quem recarrega a pagina cai direto no esqueleto e espera
 * a cotacao, que e a leitura correta: depois de fechar o navegador, nada do
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
 * Alias de `CartLine`, e nao uma interface repetida: sao o mesmo objeto, e
 * declara-los duas vezes convidaria os dois a divergirem no dia em que
 * alguem acrescentasse um campo a um deles.
 */
export type QuoteItem = CartLine;
