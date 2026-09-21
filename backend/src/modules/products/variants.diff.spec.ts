import { planVariants } from './variants.diff.js';

const CEM_ML = '64b7f1c2a1b2c3d4e5f60001';
const DECANT = '64b7f1c2a1b2c3d4e5f60002';

describe('planVariants', () => {
  it('atualiza a que tem id e cria a que nao tem', () => {
    const { plans, unknownIds } = planVariants(
      [
        { id: CEM_ML, priceCents: 19_990 },
        { priceCents: 4990, label: 'Decant 10 ml' },
      ],
      [CEM_ML],
      new Set(),
    );

    expect(unknownIds).toEqual([]);
    expect(plans).toEqual([
      { action: 'update', id: CEM_ML, data: { id: CEM_ML, priceCents: 19_990 } },
      { action: 'add', data: { priceCents: 4990, label: 'Decant 10 ml' } },
    ]);
  });

  it('apaga a variante que sumiu da lista e nunca foi vendida', () => {
    const { plans } = planVariants(
      [{ id: CEM_ML, priceCents: 19_990 }],
      [CEM_ML, DECANT],
      new Set(),
    );

    expect(plans.at(-1)).toEqual({ action: 'drop', id: DECANT });
  });

  it('apenas desativa a variante que sumiu da lista mas ja foi vendida', () => {
    // Apagar quebraria a devolucao de estoque do cancelamento, que procura a
    // variante pelo `items.variantId` do pedido.
    const { plans } = planVariants(
      [{ id: CEM_ML, priceCents: 19_990 }],
      [CEM_ML, DECANT],
      new Set([DECANT]),
    );

    expect(plans.at(-1)).toEqual({ action: 'retire', id: DECANT });
  });

  it('denuncia id que nao e do produto em vez de cria-lo', () => {
    const intruso = '64b7f1c2a1b2c3d4e5f60999';

    const { plans, unknownIds } = planVariants(
      [{ id: intruso, priceCents: 100 }],
      [CEM_ML],
      new Set(),
    );

    expect(unknownIds).toEqual([intruso]);
    expect(plans.some((plan) => plan.action === 'add')).toBe(false);
  });

  it('preserva a ordem recebida, com as aposentadas no fim', () => {
    const { plans } = planVariants(
      [{ priceCents: 100 }, { id: CEM_ML, priceCents: 200 }],
      [CEM_ML, DECANT],
      new Set([DECANT]),
    );

    expect(plans.map((plan) => plan.action)).toEqual(['add', 'update', 'retire']);
  });
});
