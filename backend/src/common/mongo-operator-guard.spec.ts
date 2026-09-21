import { findForbiddenKey } from './mongo-operator-guard.js';

describe('findForbiddenKey', () => {
  it('deixa passar o corpo que so tem campos normais', () => {
    expect(
      findForbiddenKey({
        name: 'Asad',
        variants: [{ sku: 'ASAD-100', priceCents: 19_990 }],
        nested: { deep: { deeper: true } },
      }),
    ).toBeNull();
  });

  it('recusa operador do Mongo na raiz', () => {
    expect(findForbiddenKey({ $where: 'this.price > 0' })).toBe('$where');
  });

  it('recusa operador escondido dentro de um campo', () => {
    // O classico: `{"email": {"$ne": null}}` casa com o primeiro usuario que
    // existir, se o filtro for montado com o que veio do corpo.
    expect(findForbiddenKey({ email: { $ne: null } })).toBe('$ne');
  });

  it('recusa operador dentro de uma lista', () => {
    expect(findForbiddenKey({ items: [{ ok: 1 }, { $inc: { stock: -1 } }] })).toBe('$inc');
  });

  it('recusa chave com ponto, que alcanca dentro de um documento', () => {
    expect(findForbiddenKey({ 'role.0': 'SUPER_ADMIN' })).toBe('role.0');
  });

  it('nao se perde em corpo fundo demais: para no teto e nao estoura a pilha', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;

    for (let level = 0; level < 50_000; level += 1) {
      const next: Record<string, unknown> = {};

      cursor['inner'] = next;
      cursor = next;
    }

    expect(findForbiddenKey(deep)).toBeNull();
  });

  it('nao opina sobre corpo ausente ou primitivo', () => {
    expect(findForbiddenKey(undefined)).toBeNull();
    expect(findForbiddenKey('texto')).toBeNull();
    expect(findForbiddenKey(null)).toBeNull();
  });
});
