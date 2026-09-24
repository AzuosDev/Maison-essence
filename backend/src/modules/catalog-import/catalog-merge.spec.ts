import { mergeCategory, mergeProduct, normalizeSku } from './catalog-merge.js';
import type { IncomingProduct, StoredProduct, StoredVariant } from './catalog-merge.js';

/**
 * O que estes testes protegem e uma frase so: **a lista do fornecedor nao
 * apaga o trabalho da dona.**
 *
 * Todos os casos aqui sao a mesma situacao vista de angulos diferentes — o
 * arquivo traz o campo vazio, o banco traz o campo preenchido, e o que fica
 * gravado e o do banco. Errar qualquer um deles nao quebra teste nenhum em
 * producao: apaga descricao, foto e estoque de 269 produtos de uma vez, em
 * silencio.
 */

const VARIANT_ID = '64b7f1c2a1b2c3d4e5f60001';

/** Uma linha da lista do fornecedor: preco cheio, o resto vazio. */
function fromFile(overrides: Partial<IncomingProduct> = {}): IncomingProduct {
  return {
    name: 'Khamrah Qahwa',
    slug: 'khamrah-qahwa',
    brand: '',
    description: '',
    categoryIds: ['64b7f1c2a1b2c3d4e5f6000a'],
    images: [],
    tags: [],
    isActive: true,
    isFeatured: false,
    isReadyToShip: false,
    variants: [
      {
        sku: 'ME-0036',
        label: '',
        priceCents: 15_500,
        stock: 0,
        isActive: true,
        allowBackorder: false,
      },
    ],
    ...overrides,
  };
}

/** O mesmo produto depois de algumas semanas de painel. */
function fromPanel(overrides: Partial<StoredProduct> = {}): StoredProduct {
  return {
    name: 'Khamrah Qahwa',
    brand: 'Lattafa',
    description: 'Café, canela e baunilha. Fixação de um dia inteiro.',
    categoryIds: ['64b7f1c2a1b2c3d4e5f6000a'],
    images: ['maison-essence/produtos/khamrah-qahwa-1'],
    tags: ['mais-vendidos'],
    variants: [storedVariant()],
    ...overrides,
  };
}

function storedVariant(overrides: Partial<StoredVariant> = {}): StoredVariant {
  return {
    id: VARIANT_ID,
    sku: 'ME-0036',
    label: '',
    priceCents: 14_900,
    compareAtPriceCents: null,
    stock: 12,
    image: '',
    isActive: true,
    allowBackorder: false,
    ...overrides,
  };
}

describe('mergeProduct, produto novo', () => {
  it('leva tudo do arquivo, inclusive as chaves de vitrine', () => {
    const { data, variantsCreated } = mergeProduct(
      fromFile({ isFeatured: true, isActive: false }),
      null,
    );

    expect(data.name).toBe('Khamrah Qahwa');
    expect(data.flags).toEqual({ isActive: false, isFeatured: true, isReadyToShip: false });
    expect(variantsCreated).toBe(1);
    // Variante nova nao tem `_id`: quem gera e o Mongoose.
    expect(data.variants[0]?._id).toBeUndefined();
  });
});

describe('mergeProduct, o vazio do arquivo não apaga o banco', () => {
  it('preserva descrição, fotos e marca quando o arquivo vem vazio', () => {
    const { data } = mergeProduct(fromFile(), fromPanel());

    expect(data.description).toBe('Café, canela e baunilha. Fixação de um dia inteiro.');
    expect(data.images).toEqual(['maison-essence/produtos/khamrah-qahwa-1']);
    expect(data.brand).toBe('Lattafa');
    expect(data.tags).toEqual(['mais-vendidos']);
  });

  it('preserva o estoque contado no painel quando o arquivo traz zero', () => {
    const { data } = mergeProduct(fromFile(), fromPanel());

    expect(data.variants[0]?.stock).toBe(12);
  });

  it('atualiza o preço, que e a razão de a importação existir', () => {
    const { data } = mergeProduct(fromFile(), fromPanel());

    expect(data.variants[0]?.priceCents).toBe(15_500);
  });

  it('não zera o preço gravado quando o arquivo traz zero', () => {
    // Uma exportacao quebrada, cheia de zeros, nao pode zerar o catalogo. E
    // ninguem vende a R$ 0,00: zero aqui e ausencia, nao preco.
    const { data } = mergeProduct(
      fromFile({ variants: [{ sku: 'ME-0036', priceCents: 0 }] }),
      fromPanel(),
    );

    expect(data.variants[0]?.priceCents).toBe(14_900);
  });

  it('não apaga o preço riscado que o painel cadastrou', () => {
    const { data } = mergeProduct(
      fromFile(),
      fromPanel({ variants: [storedVariant({ compareAtPriceCents: 19_900 })] }),
    );

    expect(data.variants[0]?.compareAtPriceCents).toBe(19_900);
  });

  it('escreve o que o arquivo traz preenchido', () => {
    const { data } = mergeProduct(
      fromFile({ brand: 'Lattafa Perfumes', description: 'Texto novo do fornecedor.' }),
      fromPanel(),
    );

    expect(data.brand).toBe('Lattafa Perfumes');
    expect(data.description).toBe('Texto novo do fornecedor.');
  });

  it('mantem as categorias gravadas quando o arquivo não cita nenhuma', () => {
    const { data } = mergeProduct(fromFile({ categoryIds: [] }), fromPanel());

    expect(data.categoryIds).toEqual(['64b7f1c2a1b2c3d4e5f6000a']);
  });
});

describe('mergeProduct, as chaves de vitrine são do painel', () => {
  it('não mexe em isActive, isFeatured e isReadyToShip de produto que já existe', () => {
    // O produto que a dona destacou na home continua destacado, e o que ela
    // tirou de linha nao volta a vender porque a lista ainda o cita.
    const { data } = mergeProduct(fromFile({ isFeatured: false, isActive: true }), fromPanel());

    expect(data.flags).toBeUndefined();
  });

  it('não reativa a variante que o painel desativou', () => {
    const { data } = mergeProduct(
      fromFile(),
      fromPanel({ variants: [storedVariant({ isActive: false })] }),
    );

    expect(data.variants[0]?.isActive).toBe(false);
  });
});

describe('mergeProduct, casamento de variantes pelo SKU', () => {
  it('preserva o _id da variante que continua', () => {
    // O pedido guarda `items.variantId`. Trocar o `_id` quebraria a devolucao
    // de estoque do cancelamento.
    const { data } = mergeProduct(fromFile(), fromPanel());

    expect(data.variants[0]?._id).toBe(VARIANT_ID);
  });

  it('desativa, sem apagar, a variante que sumiu do arquivo', () => {
    const { data, variantsDeactivated } = mergeProduct(
      fromFile(),
      fromPanel({ variants: [storedVariant(), storedVariant({ id: 'outro', sku: 'ME-9999' })] }),
    );

    expect(variantsDeactivated).toBe(1);
    expect(data.variants).toHaveLength(2);
    expect(data.variants[1]).toMatchObject({ _id: 'outro', sku: 'ME-9999', isActive: false });
  });

  it('não conta de novo a variante que já estava desativada', () => {
    // Sem isso, toda importacao repetiria o mesmo numero de desativadas para
    // sempre e o relatorio deixaria de descrever aquela execucao.
    const { variantsDeactivated } = mergeProduct(
      fromFile(),
      fromPanel({
        variants: [storedVariant(), storedVariant({ id: 'outro', sku: 'ME-9999', isActive: false })],
      }),
    );

    expect(variantsDeactivated).toBe(0);
  });

  it('casa o SKU sem ligar para caixa nem espaço', () => {
    const { data, variantsCreated } = mergeProduct(
      fromFile({ variants: [{ sku: ' me-0036 ', priceCents: 15_500 }] }),
      fromPanel(),
    );

    expect(variantsCreated).toBe(0);
    expect(data.variants[0]?._id).toBe(VARIANT_ID);
  });

  it('cria a variante que o arquivo trouxe e o banco não tinha', () => {
    const { data, variantsCreated } = mergeProduct(
      fromFile({
        variants: [
          { sku: 'ME-0036', priceCents: 15_500 },
          { sku: 'ME-0036-25', label: '25ml', priceCents: 4600 },
        ],
      }),
      fromPanel(),
    );

    expect(variantsCreated).toBe(1);
    expect(data.variants[1]).toMatchObject({ sku: 'ME-0036-25', label: '25ml', stock: 0 });
  });
});

describe('mergeCategory', () => {
  it('cria com a posição e o estado que o arquivo pede', () => {
    const data = mergeCategory(
      { name: 'Árabes Masculinos', slug: 'arabes-masculinos', order: 1, isActive: true },
      'pai',
      null,
    );

    expect(data).toEqual({
      name: 'Árabes Masculinos',
      slug: 'arabes-masculinos',
      parentId: 'pai',
      order: 1,
      isActive: true,
      image: '',
    });
  });

  it('atualiza o nome e o pai, e deixa o menu como o painel o deixou', () => {
    // Reordenar o menu e arrastar categoria por categoria. Uma importacao de
    // preco nao desfaz isso.
    const data = mergeCategory(
      { name: 'Árabes Masculinos', slug: 'arabes-masculinos', order: 1, isActive: true },
      'pai',
      { name: 'Masculinos', order: 7, isActive: false, image: 'capa' },
    );

    expect(data).toEqual({
      name: 'Árabes Masculinos',
      slug: 'arabes-masculinos',
      parentId: 'pai',
      order: 7,
      isActive: false,
      image: 'capa',
    });
  });
});

describe('normalizeSku', () => {
  it('tira espaço e sobe a caixa', () => {
    expect(normalizeSku('  me-0036 ')).toBe('ME-0036');
  });
});
