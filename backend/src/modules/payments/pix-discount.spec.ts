import { pixQuoteOf } from './pix-discount.js';

describe('pixQuoteOf', () => {
  it('desconta sobre o subtotal de produtos', () => {
    expect(pixQuoteOf(10_000, 0, 5)).toEqual({ discountCents: 500, totalCents: 9500 });
  });

  /**
   * A regra inteira deste arquivo em um teste: a entrega entra no total
   * depois do desconto e nunca dentro dele. R$ 100 de produto mais R$ 25 de
   * frete com 5% de desconto sao R$ 120,00 — e nao R$ 118,75, que seria a
   * loja bancando parte do frete de quem paga no PIX.
   */
  it('nunca desconta a taxa de entrega', () => {
    expect(pixQuoteOf(10_000, 2500, 5)).toEqual({ discountCents: 500, totalCents: 12_000 });
  });

  it('sem percentual, o total e a soma simples', () => {
    expect(pixQuoteOf(10_000, 2500, 0)).toEqual({ discountCents: 0, totalCents: 12_500 });
  });

  it('arredonda o centavo a favor de quem paga', () => {
    // 5% de R$ 99,99 sao R$ 4,9995.
    expect(pixQuoteOf(9999, 0, 5).discountCents).toBe(500);
  });

  it('entrega grátis não muda o desconto', () => {
    expect(pixQuoteOf(20_000, 0, 10)).toEqual({ discountCents: 2000, totalCents: 18_000 });
  });
});
