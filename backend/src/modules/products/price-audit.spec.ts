import { priceChangesBetween } from './price-audit.js';
import type { PriceSnapshot } from './price-audit.js';

function snapshot(entries: Record<string, [string, number, number | null]>): PriceSnapshot {
  return Object.fromEntries(
    Object.entries(entries).map(([id, [sku, priceCents, compareAtPriceCents]]) => [
      id,
      { sku, priceCents, compareAtPriceCents },
    ]),
  );
}

describe('priceChangesBetween', () => {
  it('nao acha mudanca onde nao houve', () => {
    const before = snapshot({ a: ['ASAD-100', 19_990, null] });

    expect(priceChangesBetween(before, before)).toEqual({});
  });

  it('registra o preco de venda com o valor de antes e o de depois', () => {
    expect(
      priceChangesBetween(
        snapshot({ a: ['ASAD-100', 19_990, null] }),
        snapshot({ a: ['ASAD-100', 17_990, null] }),
      ),
    ).toEqual({ 'ASAD-100.priceCents': { from: 19_990, to: 17_990 } });
  });

  it('registra tambem o preco riscado, inclusive quando ele nasce ou some', () => {
    expect(
      priceChangesBetween(
        snapshot({ a: ['ASAD-100', 17_990, null] }),
        snapshot({ a: ['ASAD-100', 17_990, 24_990] }),
      ),
    ).toEqual({ 'ASAD-100.compareAtPriceCents': { from: null, to: 24_990 } });
  });

  it('usa o SKU novo como rotulo quando ele tambem mudou no mesmo PATCH', () => {
    // A comparacao e pelo id da variante, entao trocar o SKU nao cria uma
    // variante nova nem esconde a mudanca de preco.
    expect(
      priceChangesBetween(
        snapshot({ a: ['ASAD-100', 19_990, null] }),
        snapshot({ a: ['ASAD-100ML', 17_990, null] }),
      ),
    ).toEqual({ 'ASAD-100ML.priceCents': { from: 19_990, to: 17_990 } });
  });

  it('ignora variante que nasceu e variante que saiu', () => {
    expect(
      priceChangesBetween(
        snapshot({ a: ['ASAD-100', 19_990, null] }),
        snapshot({ b: ['ASAD-50', 9_990, null] }),
      ),
    ).toEqual({});
  });
});
