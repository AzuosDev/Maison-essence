import type { StoreGift } from './schemas/store-settings.schema.js';

/**
 * O brinde por valor de compra: de quatro campos guardados a uma promessa.
 *
 * ## Por que a decisão mora aqui, e não na tela
 *
 * Porque três telas fazem a mesma pergunta e precisam da mesma resposta: o
 * balão da loja ("Compre R$ 179,99 e ganhe..."), a régua da sacola ("faltam
 * R$ 40,00 para o brinde") e a mensagem do pedido que chega no WhatsApp da
 * dona. Se cada uma decidisse por conta própria quando o brinde vale, a loja
 * prometeria numa tela o que não cumpre na outra — e quem descobre isso e a
 * cliente, depois de comprar.
 *
 * ## Quando o brinde não esta de pé
 *
 * Configuração pela metade não vira promessa. Falta qualquer um destes e o
 * brinde simplesmente não existe para a loja aberta:
 *
 * - **desligado**: a campanha guardada para dezembro não anuncia em janeiro;
 * - **sem valor meta**: "ganhe um brinde" sem dizer a partir de quanto e
 *   anúncio que não se pode cumprir nem conferir;
 * - **sem nome**: sem frase escrita e sem produto escolhido não há o que
 *   prometer. A foto pode faltar — o balão sobrevive sem ela —, o nome não.
 *
 * E a mesma regra do CNPJ do rodapé e do brinde que vivia em constante antes
 * deste campo existir: promessa só quando e verdade.
 */

/** O produto do brinde, reduzido ao que a loja mostra dele. */
export interface GiftProduct {
  name: string;
  /** `publicId` da capa no Cloudinary. Vazio quando o produto não tem foto. */
  image: string;
}

/** O brinde de pé, pronto para ser anunciado. */
export interface GiftOffer {
  /** O subtotal que libera o brinde. Sempre maior que zero. */
  minCents: number;
  /** O que se ganha: "um porta hidratante com a melhor pasta árabe dentro". */
  label: string;
  /** `publicId` da foto. Vazio e legitimo: o balão desenha sem foto. */
  image: string;
}

/**
 * O brinde como a loja o anuncia, ou `null` quando ele não esta de pé.
 *
 * A frase escrita no painel vence o nome do produto, e não o contrário: "um
 * porta hidratante com a melhor pasta árabe dentro" vende o que "Porta
 * Hidratante ME" não vende. O nome do produto e a rede de segurança para
 * quando a dona escolhe o produto e não escreve nada.
 */
export function liveGift(gift: StoreGift, product: GiftProduct | null): GiftOffer | null {
  if (!gift.isActive || gift.minCents === null || gift.minCents <= 0) {
    return null;
  }

  const label = gift.label.trim() === '' ? (product?.name.trim() ?? '') : gift.label.trim();

  if (label === '') {
    return null;
  }

  return { minCents: gift.minCents, label, image: product?.image ?? '' };
}

/**
 * Este pedido ganhou o brinde?
 *
 * Mede pelo subtotal dos produtos — o mesmo número da régua da sacola —, e
 * não pelo total: frete e desconto do PIX entram depois, e um pedido que
 * passou da meta não pode perder o brinde porque o cliente escolheu retirar
 * na loja.
 *
 * Devolve um predicado de tipo, e não um booleano: quem pergunta isto quer,
 * na linha seguinte, a frase do brinde — e sem o predicado o TypeScript
 * continuaria achando que a oferta pode ser `null` ali.
 */
export function giftEarned(offer: GiftOffer | null, subtotalCents: number): offer is GiftOffer {
  return offer !== null && subtotalCents >= offer.minCents;
}
