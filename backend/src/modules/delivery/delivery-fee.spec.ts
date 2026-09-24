import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import { freeFromCents, resolveDeliveryFee } from './delivery-fee.js';
import type { FeeCity } from './delivery-fee.js';

const SOBRAL: FeeCity = { name: 'Sobral', feeCents: 1000, minOrderForFreeCents: 15_000 };

/** Sem regra própria: cai na regra global da loja, quando houver. */
const FORTALEZA: FeeCity = { name: 'Fortaleza', feeCents: 2500, minOrderForFreeCents: null };

function delivery(
  city: FeeCity,
  subtotalCents: number,
  freeShippingMinCents: number | null = null,
) {
  return resolveDeliveryFee({
    mode: FULFILLMENT_MODES.DELIVERY,
    city,
    subtotalCents,
    freeShippingMinCents,
  });
}

describe('resolveDeliveryFee', () => {
  describe('retirada na loja', () => {
    it('zera a taxa e diz por que', () => {
      const fee = resolveDeliveryFee({ mode: FULFILLMENT_MODES.PICKUP });

      expect(fee.feeCents).toBe(0);
      expect(fee.isFree).toBe(true);
      expect(fee.freeReason).toBe('Retirada na loja: sem taxa de entrega.');
      expect(fee.missingForFreeCents).toBeNull();
    });
  });

  describe('entrega', () => {
    it('cobra a taxa da cidade quando não há regra nenhuma', () => {
      const fee = delivery(FORTALEZA, 5000);

      expect(fee).toEqual({
        feeCents: 2500,
        isFree: false,
        freeReason: '',
        missingForFreeCents: null,
      });
    });

    it('isenta pela regra da cidade e preenche o motivo', () => {
      const fee = delivery(SOBRAL, 20_000);

      expect(fee.feeCents).toBe(0);
      expect(fee.isFree).toBe(true);
      expect(fee.freeReason).toBe('Frete grátis para Sobral em pedidos a partir de R$ 150,00.');
    });

    // O mínimo e alcançado, não ultrapassado: pedido de exatamente R$ 150 em
    // cidade com mínimo de R$ 150 tem frete grátis. Quem escreve "a partir de"
    // na tela esta prometendo isso.
    it('isenta no valor exato do mínimo', () => {
      expect(delivery(SOBRAL, 15_000).isFree).toBe(true);
      expect(delivery(SOBRAL, 14_999).isFree).toBe(false);
    });

    it('diz quanto falta para o frete sair de graça', () => {
      const fee = delivery(SOBRAL, 12_000);

      expect(fee.feeCents).toBe(1000);
      expect(fee.isFree).toBe(false);
      expect(fee.freeReason).toBe('');
      expect(fee.missingForFreeCents).toBe(3000);
    });

    it('aplica a regra global onde a cidade não tem a sua', () => {
      const fee = delivery(FORTALEZA, 30_000, 25_000);

      expect(fee.isFree).toBe(true);
      expect(fee.freeReason).toBe('Frete grátis em pedidos a partir de R$ 250,00.');
    });

    it('cobra e conta o que falta pela regra global', () => {
      const fee = delivery(FORTALEZA, 20_000, 25_000);

      expect(fee.feeCents).toBe(2500);
      expect(fee.missingForFreeCents).toBe(5000);
    });

    /**
     * O caso que da nome a regra: a cidade pede R$ 150 e a loja perdoa a
     * partir de R$ 100. Um pedido de R$ 120 em Sobral paga frete, porque o
     * mínimo da cidade substitui o da loja inteiro em vez de disputar com ele.
     * Sem precedência, toda cidade distante cairia na regra geral e a taxa
     * mais alta que a dona cadastrou para ela nunca seria cobrada.
     */
    it('a regra da cidade tem precedência sobre a global, inclusive quando e pior', () => {
      const fee = delivery(SOBRAL, 12_000, 10_000);

      expect(fee.isFree).toBe(false);
      expect(fee.feeCents).toBe(1000);
      expect(fee.missingForFreeCents).toBe(3000);
    });

    it('cidade com taxa zero e gratuita com motivo próprio', () => {
      const fee = delivery({ name: 'Sobral', feeCents: 0, minOrderForFreeCents: null }, 100);

      expect(fee.isFree).toBe(true);
      expect(fee.freeReason).toBe('A entrega para Sobral e gratuita.');
    });
  });
});

describe('freeFromCents', () => {
  it('devolve o mínimo da cidade quando ela tem um', () => {
    expect(freeFromCents(SOBRAL, 25_000)).toBe(15_000);
  });

  it('cai no da loja quando a cidade não tem', () => {
    expect(freeFromCents(FORTALEZA, 25_000)).toBe(25_000);
  });

  it('devolve null quando não há regra dos dois lados', () => {
    expect(freeFromCents(FORTALEZA, null)).toBeNull();
  });
});
