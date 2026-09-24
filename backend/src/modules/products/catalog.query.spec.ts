import { Types } from 'mongoose';
import {
  catalogCollation,
  catalogFilter,
  catalogPipeline,
  effectiveSort,
  hasTextScore,
} from './catalog.query.js';
import type { PublicSort } from './catalog.query.js';

/** O `$elemMatch` das variantes, que todo filtro da vitrine carrega. */
function variantMatch(filter: Record<string, any>): Record<string, any> {
  return filter.variants.$elemMatch;
}

function stageNames(stages: readonly object[]): string[] {
  return stages.flatMap((stage) => Object.keys(stage));
}

describe('catalogFilter', () => {
  it('só lista produto ativo, e só com variante a venda', () => {
    const filter = catalogFilter({});

    expect(filter.isActive).toBe(true);
    expect(variantMatch(filter)).toEqual({ isActive: true });
  });

  /**
   * O critério de aceite do catálogo público: categoria, faixa de preço e
   * estoque em uma consulta só. Preço e estoque ficam no mesmo `$elemMatch`
   * porque tem de ser a mesma variante — senão o produto entraria na lista
   * pela variante barata que acabou.
   */
  it('combina categoria, faixa de preço e estoque numa consulta só', () => {
    const categoryId = new Types.ObjectId();
    const filter = catalogFilter({
      categoryIds: [categoryId],
      minPriceCents: 10_000,
      maxPriceCents: 30_000,
      inStock: true,
    });

    expect(filter.categoryIds).toEqual({ $in: [categoryId] });
    expect(variantMatch(filter)).toEqual({
      isActive: true,
      priceCents: { $gte: 10_000, $lte: 30_000 },
      $or: [{ stock: { $gt: 0 } }, { allowBackorder: true }],
    });
  });

  it('aceita só o piso ou só o teto da faixa', () => {
    expect(variantMatch(catalogFilter({ minPriceCents: 5000 })).priceCents).toEqual({
      $gte: 5000,
    });
    expect(variantMatch(catalogFilter({ maxPriceCents: 5000 })).priceCents).toEqual({
      $lte: 5000,
    });
  });

  it('conta encomenda como disponível', () => {
    expect(variantMatch(catalogFilter({ inStock: true })).$or).toContainEqual({
      allowBackorder: true,
    });
  });

  it('acha a marca sem depender de maiúscula, e só ela', () => {
    const { brand } = catalogFilter({ brand: 'lattafa' });

    expect(brand).toBeInstanceOf(RegExp);
    expect('Lattafa').toMatch(brand as RegExp);
    expect('Lattafa Qaed').not.toMatch(brand as RegExp);
  });

  it('não deixa a marca digitada virar regex', () => {
    const { brand } = catalogFilter({ brand: 'A.L' });

    expect('AxL').not.toMatch(brand as RegExp);
    expect('A.L').toMatch(brand as RegExp);
  });

  it('bandeira desligada não filtra nada', () => {
    const filter = catalogFilter({ featured: false, readyToShip: false });

    expect(filter.isFeatured).toBeUndefined();
    expect(filter.isReadyToShip).toBeUndefined();
  });

  it('bandeira ligada filtra', () => {
    expect(catalogFilter({ featured: true }).isFeatured).toBe(true);
    expect(catalogFilter({ readyToShip: true }).isReadyToShip).toBe(true);
  });

  it('usa o índice de texto na busca com três caracteres ou mais', () => {
    expect(catalogFilter({ q: 'asad' }).$text).toEqual({ $search: 'asad' });
  });

  it('cai no regex quando o termo e curto demais para o índice', () => {
    const filter = catalogFilter({ q: 'as' });

    expect(filter.$text).toBeUndefined();
    expect(filter.$or).toHaveLength(2);
  });
});

describe('effectiveSort', () => {
  it('sem pedido: relevância quando há busca, novidade quando não há', () => {
    expect(effectiveSort(undefined, true)).toBe('relevance');
    expect(effectiveSort(undefined, false)).toBe('newest');
  });

  /** Relevância sem termo não ordena nada: todo produto teria a mesma nota. */
  it('troca relevância por novidade quando não há o que pontuar', () => {
    expect(effectiveSort('relevance', false)).toBe('newest');
  });

  it('respeita a ordenação pedida', () => {
    for (const sort of ['newest', 'price_asc', 'price_desc', 'discount', 'name'] as PublicSort[]) {
      expect(effectiveSort(sort, true)).toBe(sort);
    }
  });
});

describe('hasTextScore', () => {
  it('só há nota de relevância quando a busca passou pelo índice', () => {
    expect(hasTextScore('asad')).toBe(true);
    expect(hasTextScore('as')).toBe(false);
    expect(hasTextScore('')).toBe(false);
  });
});

describe('catalogPipeline', () => {
  it('página na ordem pedida e descarta a descrição', () => {
    const stages = catalogPipeline({}, 'newest', false, 24, 24);

    expect(stageNames(stages)).toEqual(['$match', '$sort', '$skip', '$limit', '$unset']);
    expect(stages.at(-1)).toEqual({ $unset: ['description'] });
  });

  it('desempata pelo _id, para a página 2 não repetir a 1', () => {
    const [, sort] = catalogPipeline({}, 'newest', false, 0, 24) as unknown as Record<string, any>[];

    expect(Object.keys(sort.$sort).at(-1)).toBe('_id');
  });

  it('calcula preço e desconto só quando a ordenação precisa', () => {
    expect(stageNames(catalogPipeline({}, 'price_asc', false, 0, 24))).toContain('$addFields');
    expect(stageNames(catalogPipeline({}, 'newest', false, 0, 24))).not.toContain('$addFields');
  });

  it('ordena por preço pelo menor preço entre as variantes a venda', () => {
    const stages = catalogPipeline({}, 'price_asc', false, 0, 24) as unknown as Record<string, any>[];
    const [sort] = stages.filter((stage) => '$sort' in stage);

    expect(sort.$sort._price).toBe(1);
    expect(stages.some((stage) => '$addFields' in stage && '_liveVariants' in stage.$addFields)).toBe(
      true,
    );
  });

  it('pontua a relevância só quando a busca usou o índice de texto', () => {
    const withText = catalogPipeline({}, 'relevance', true, 0, 24) as unknown as Record<string, any>[];
    const withoutText = catalogPipeline({}, 'relevance', false, 0, 24) as unknown as Record<string, any>[];

    expect(withText[1].$addFields._score).toEqual({ $meta: 'textScore' });
    expect(stageNames(withoutText)).not.toContain('$addFields');
  });

  it('limpa os campos de ordenação antes de devolver', () => {
    const stages = catalogPipeline({}, 'discount', false, 0, 24) as unknown as Record<string, any>[];

    expect(stages.at(-1)?.$unset).toEqual([
      '_liveVariants',
      '_price',
      '_discount',
      'description',
    ]);
  });
});

describe('catalogCollation', () => {
  it('ordena nome pelas regras do português, e só nome', () => {
    expect(catalogCollation('name')).toEqual({ locale: 'pt', strength: 1 });
    expect(catalogCollation('newest')).toBeUndefined();
  });
});
