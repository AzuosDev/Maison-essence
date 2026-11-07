import { formatCents } from '../../common/money.js';

/**
 * Teto de usos de um cupom.
 *
 * Dez mil e mais do que esta loja vende num ano. Existe para transformar erro
 * de digitação em erro de validação, como todo teto deste projeto: um zero a
 * mais num cupom de 50 usos viraria 500 descontos que ninguém autorizou.
 */
export const MAX_COUPON_USES = 10_000;

/** Tamanho do código. Curto o bastante para ser digitado no celular. */
export const MIN_COUPON_CODE_LENGTH = 3;
export const MAX_COUPON_CODE_LENGTH = 24;

/**
 * O formato do código: letras e números, nada mais.
 *
 * Sem espaço, sem acento e sem hífen porque o código e digitado no celular, em
 * teclado de vidro, por quem esta com o cartão na mão — e porque e ditado no
 * WhatsApp e lido em voz alta. `BLACK-FRIDAY!` seria quatro chances de errar o
 * desconto que a loja prometeu.
 *
 * Declarado aqui, e não escrito duas vezes: o schema o usa para recusar a
 * gravação e o DTO para recusar o corpo, e as duas recusas precisam ser a
 * mesma.
 */
export const COUPON_CODE_PATTERN = new RegExp(
  `^[A-Z0-9]{${String(MIN_COUPON_CODE_LENGTH)},${String(MAX_COUPON_CODE_LENGTH)}}$`,
);

/** Teto do nome da campanha e da linha que a anuncia na home. */
export const MAX_COUPON_TITLE_LENGTH = 60;
export const MAX_COUPON_TAGLINE_LENGTH = 120;

/**
 * Quantos produtos um cupom pode apontar.
 *
 * O mesmo teto da cotação, e pelo mesmo motivo: a lista entra num `$in` e
 * viaja na resposta publica da campanha.
 */
export const MAX_COUPON_PRODUCTS = 50;

/** Percentual que um cupom pode dar. Acima de 90% e erro de digitação. */
export const MIN_COUPON_PERCENT = 1;
export const MAX_COUPON_PERCENT = 90;

/**
 * A partir de quantos cupons restantes a loja para de contar em voz alta.
 *
 * "Restam 7" vende; "restam 48" só informa que a campanha e grande. A escassez
 * aparece quando e verdade e quando aperta — e nunca e fabricada: o número sai
 * do teto que a gerente escreveu menos o que já foi usado.
 */
export const SCARCITY_THRESHOLD = 10;

export const COUPON_NOT_FOUND_MESSAGE = 'Cupom não encontrado.';

export const CAMPAIGN_NOT_FOUND_MESSAGE = 'Essa campanha não esta no ar.';

export const CODE_TAKEN_MESSAGE =
  'Já existe um cupom com esse código. Edite o que existe em vez de criar outro com desconto diferente.';

export const ONE_DISCOUNT_MESSAGE =
  'Escolha um tipo de desconto: percentual ou valor em reais, nunca os dois.';

export const INVALID_WINDOW_MESSAGE =
  'A campanha termina antes de começar. Confira as datas.';

/**
 * Recusas do cupom na cotação, escritas para quem esta comprando.
 *
 * Nenhuma delas derruba a cotação: voltam em `warnings`, a sacola continua
 * somando certo e a cliente lê por que o código não pegou. E a mesma escolha
 * do item sem estoque — ver `cart.constants.ts`.
 *
 * Código errado, cupom desligado e campanha que ainda não começou dao a mesma
 * frase. Para quem digitou, a diferença entre "não existe" e "existe mas não
 * vale hoje" não muda nada, e distinguir seria contar ao visitante quais
 * códigos a loja tem guardados.
 */
export const COUPON_UNKNOWN_WARNING =
  'Esse cupom não e válido. Confira o código ou siga sem ele.';

export const COUPON_EXPIRED_WARNING = 'Esse cupom venceu e não vale mais.';

export const COUPON_EXHAUSTED_WARNING =
  'Esse cupom esgotou: todas as unidades dele já foram usadas.';

/** O cupom existe e esta no ar, mas nenhum item da sacola e dele. */
export const COUPON_NOT_FOR_ITEMS_WARNING =
  'Esse cupom não vale para os itens da sacola. Veja os produtos da campanha.';

/** O desconto por extenso, do jeito que a faixa da home o anuncia. */
export function discountLabel(percentOff: number | null, amountOffCents: number | null): string {
  if (percentOff !== null) {
    return `${String(percentOff)}% OFF`;
  }

  return amountOffCents === null ? '' : `${formatCents(amountOffCents)} OFF`;
}
