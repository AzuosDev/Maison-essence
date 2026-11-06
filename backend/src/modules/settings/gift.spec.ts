import { Types } from 'mongoose';
import { giftEarned, liveGift } from './gift.js';
import type { GiftProduct } from './gift.js';
import type { StoreGift } from './schemas/store-settings.schema.js';

/**
 * O brinde por valor de compra.
 *
 * O que estes casos protegem e a promessa: o balão da loja, a régua da sacola
 * e a mensagem do pedido leem daqui, e uma divergência entre as três e a loja
 * prometendo numa tela o que não cumpre na outra. A cliente e quem descobre,
 * depois de comprar.
 */

const PRODUTO: GiftProduct = { name: 'Porta Hidratante ME', image: 'maison/brinde' };

function gift(overrides: Partial<StoreGift> = {}): StoreGift {
  return {
    isActive: true,
    minCents: 17_999,
    productId: new Types.ObjectId(),
    label: 'um porta hidratante com a melhor pasta árabe dentro',
    ...overrides,
  } as StoreGift;
}

describe('liveGift', () => {
  it('devolve a frase, o valor e a foto quando a campanha esta de pé', () => {
    expect(liveGift(gift(), PRODUTO)).toEqual({
      minCents: 17_999,
      label: 'um porta hidratante com a melhor pasta árabe dentro',
      image: 'maison/brinde',
    });
  });

  /** Campanha guardada para dezembro não anuncia em janeiro. */
  it('não anuncia brinde desligado', () => {
    expect(liveGift(gift({ isActive: false }), PRODUTO)).toBeNull();
  });

  /**
   * "Ganhe um brinde" sem dizer a partir de quanto e anúncio que ninguém
   * pode cumprir nem conferir.
   */
  it('não anuncia brinde sem valor meta', () => {
    expect(liveGift(gift({ minCents: null }), PRODUTO)).toBeNull();
    expect(liveGift(gift({ minCents: 0 }), PRODUTO)).toBeNull();
  });

  /** Sem frase e sem produto não há o que prometer. */
  it('não anuncia brinde sem nome nenhum', () => {
    expect(liveGift(gift({ label: '' }), null)).toBeNull();
    expect(liveGift(gift({ label: '   ' }), null)).toBeNull();
  });

  /**
   * A frase escrita vence o nome do produto.
   *
   * "um porta hidratante com a melhor pasta árabe dentro" vende o que "Porta
   * Hidratante ME" não vende.
   */
  it('prefere a frase do painel ao nome do produto', () => {
    expect(liveGift(gift(), PRODUTO)?.label).toBe(
      'um porta hidratante com a melhor pasta árabe dentro',
    );
  });

  it('cai no nome do produto quando a frase esta em branco', () => {
    expect(liveGift(gift({ label: '' }), PRODUTO)?.label).toBe('Porta Hidratante ME');
  });

  /**
   * Produto apagado do cadastro não derruba a campanha.
   *
   * A promessa e da loja, não do catálogo: um balão sem foto e melhor do que
   * uma campanha que some porque alguém mexeu em produtos.
   */
  it('segue de pé sem o produto, desde que haja frase', () => {
    expect(liveGift(gift(), null)).toEqual({
      minCents: 17_999,
      label: 'um porta hidratante com a melhor pasta árabe dentro',
      image: '',
    });
  });
});

describe('giftEarned', () => {
  const oferta = liveGift(gift(), PRODUTO);

  it('o valor exato da meta já ganha', () => {
    expect(giftEarned(oferta, 17_999)).toBe(true);
  });

  it('um centavo abaixo não ganha', () => {
    expect(giftEarned(oferta, 17_998)).toBe(false);
  });

  it('sem campanha, nenhum pedido ganha', () => {
    expect(giftEarned(null, 1_000_000)).toBe(false);
  });
});
