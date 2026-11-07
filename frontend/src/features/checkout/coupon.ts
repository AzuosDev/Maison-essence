import type { AppliedCoupon, CartQuote } from '@/features/cart';
import { formatCents } from '@/lib/format';

/**
 * O cupom no fechamento: as regras da caixa, sem React e sem rede.
 *
 * Funções puras, pela mesma razão que `catalog.filters` e `coupons.ts` do
 * painel são puros: o que decide se a tela diz "aplicado" ou "esse cupom
 * venceu" e testável sem montar componente nenhum, e esse e o código que não
 * pode errar — errar aqui e prometer um desconto que o pedido vai recusar.
 *
 * Nenhuma conta de dinheiro acontece neste arquivo. `discountCents` e
 * `eligibleSubtotalCents` vem calculados de `POST /cart/quote`, contra o
 * catálogo de agora; o que existe aqui e a escolha de qual frase escrever em
 * volta deles.
 */

/** Tamanho do código, igual ao do backend (`coupons.constants.ts`). */
export const COUPON_CODE_MIN = 3;
export const COUPON_CODE_MAX = 24;

/**
 * O código como o servidor o aceita: maiúsculas, letras e números.
 *
 * A normalização e na digitação, e não no envio, de propósito. O código e
 * ditado no WhatsApp e lido em voz alta — `black friday`, `Black-Friday`,
 * ` BLACKFRIDAY ` são a mesma coisa para quem dita e três códigos diferentes
 * para um campo de texto. Arrumar na hora mostra a cliente o código que vai
 * ser conferido, em vez de deixá-la descobrir no clique que o espaço que ela
 * não vê invalidou o desconto.
 *
 * O servidor normaliza de novo no DTO. As duas são a mesma regra, e nenhuma
 * confia na outra.
 */
export function normalizeCouponCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, COUPON_CODE_MAX);
}

/**
 * Em que pe esta o cupom.
 *
 * Quatro estados, e `checking` existe por um detalhe do cache: a cotação
 * mantem a resposta anterior na tela enquanto busca a nova
 * (`placeholderData`), então entre o clique em "Aplicar" e a resposta a mão
 * tem uma cotação que **não sabe** do código novo. Sem este estado, a caixa
 * leria aquela resposta e anunciaria o resultado do código anterior — ou um
 * "não e válido" que ninguém mereceu ainda.
 */
export type CouponState =
  | { kind: 'none' }
  | { kind: 'checking'; code: string }
  | { kind: 'applied'; coupon: AppliedCoupon }
  | { kind: 'refused'; code: string; reason: string };

const NONE: CouponState = { kind: 'none' };

export function couponStateOf(
  code: string,
  quote: CartQuote | undefined,
  isFetching: boolean,
): CouponState {
  if (code === '') {
    return NONE;
  }

  if (quote === undefined || isFetching) {
    return { kind: 'checking', code };
  }

  if (quote.coupon !== null && quote.coupon.code === code) {
    return { kind: 'applied', coupon: quote.coupon };
  }

  if (quote.couponWarning !== '') {
    return { kind: 'refused', code, reason: quote.couponWarning };
  }

  /*
   * Código aplicado, cotação sem cupom e sem recusa: a resposta na mão e de
   * antes do código. Acontece no quadro entre a mudança da chave e o começo
   * da busca, e o honesto ali e "conferindo" — nunca "não valeu".
   */
  return { kind: 'checking', code };
}

/**
 * O que o cupom alcançou, quando ele não alcançou tudo.
 *
 * Vazio no cupom da loja inteira e no cupom de produtos que por acaso pegou
 * a sacola toda. Escrito quando ha diferença, porque e a diferença que a
 * cliente precisa entender: 20% de uma sacola de R$ 500 dando R$ 40 parece
 * erro de conta até alguém dizer que só R$ 200 dela estavam na campanha.
 *
 * Esta e a frase que evita a mensagem no WhatsApp perguntando se o desconto
 * foi aplicado errado.
 */
export function couponReachLabel(coupon: AppliedCoupon, subtotalCents: number): string {
  if (coupon.wholeStore || coupon.eligibleSubtotalCents >= subtotalCents) {
    return '';
  }

  return `Sobre ${formatCents(coupon.eligibleSubtotalCents)} em produtos da campanha.`;
}

/**
 * O que o botão da caixa faz agora.
 *
 * Um botão só, dois trabalhos, e quem decide qual e o estado — não uma
 * segunda caixa. Com o cupom aplicado o campo esta travado mostrando o
 * código que valeu, e a única coisa a fazer ali e tirá-lo.
 */
export function couponActionLabel(state: CouponState): 'Aplicar' | 'Tirar' {
  return state.kind === 'applied' ? 'Tirar' : 'Aplicar';
}

/**
 * O código pode ser enviado.
 *
 * O piso de três caracteres e o do servidor, e e o que impede a caixa de
 * gastar uma ida ao servidor para ouvir que `BF` não existe. Vazio também
 * não vai: quem apertou "Aplicar" sem digitar nada não recebe recusa, recebe
 * o foco de volta no campo.
 */
export function canSubmitCoupon(draft: string): boolean {
  return normalizeCouponCode(draft).length >= COUPON_CODE_MIN;
}
