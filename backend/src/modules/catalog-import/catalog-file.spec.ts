import {
  CatalogFormatError,
  readCatalogEnvelope,
  readCategoryEntry,
  readProductEntry,
} from './catalog-file.js';

describe('readCatalogEnvelope', () => {
  it('separa as duas listas e ignora os metadados do arquivo', () => {
    const envelope = readCatalogEnvelope({
      generatedAt: '2026-09-22',
      notes: ['qualquer coisa'],
      categories: [{ slug: 'perfumes' }],
      products: [{ slug: 'asad' }],
    });

    expect(envelope.categories).toHaveLength(1);
    expect(envelope.products).toHaveLength(1);
  });

  it('recusa o que não tem as duas listas', () => {
    // E a única recusa que derruba a importação inteira: sem as listas não há
    // o que importar nem o que relatar.
    expect(() => readCatalogEnvelope({ products: [] })).toThrow(CatalogFormatError);
    expect(() => readCatalogEnvelope([])).toThrow(CatalogFormatError);
    expect(() => readCatalogEnvelope(null)).toThrow(CatalogFormatError);
  });
});

describe('readProductEntry', () => {
  it('tira os nulos que o arquivo usa onde a API usa a ausência', () => {
    // `brand: null` e "esta lista não informa marca", não "apague a marca". O
    // `@IsOptional` deixaria o nulo passar e a marca gravada seria apagada.
    const { candidate } = readProductEntry({
      name: 'Asad',
      slug: 'asad',
      brand: null,
      description: null,
      variants: [{ sku: 'ME-0001', priceCents: 18_500, compareAtPriceCents: null, image: null }],
    });

    expect('brand' in candidate).toBe(false);
    expect('description' in candidate).toBe(false);

    const [variant] = candidate.variants as Record<string, unknown>[];

    expect('compareAtPriceCents' in (variant ?? {})).toBe(false);
    expect('image' in (variant ?? {})).toBe(false);
  });

  it('preserva o zero e o falso, que são valores e não ausências', () => {
    const { candidate } = readProductEntry({
      name: 'Asad',
      slug: 'asad',
      isFeatured: false,
      variants: [{ sku: 'ME-0001', priceCents: 18_500, stock: 0, allowBackorder: false }],
    });

    expect(candidate.isFeatured).toBe(false);

    const [variant] = candidate.variants as Record<string, unknown>[];

    expect(variant?.stock).toBe(0);
    expect(variant?.allowBackorder).toBe(false);
  });

  it('não converte nada: o valor errado chega cru ao validador', () => {
    // Coagir aqui transformaria um preço digitado errado num número plausível
    // em vez de numa linha no relatório.
    const { candidate } = readProductEntry({
      name: 'Asad',
      slug: 'asad',
      variants: [{ sku: 'ME-0001', priceCents: '18500' }],
    });

    const [variant] = candidate.variants as Record<string, unknown>[];

    expect(variant?.priceCents).toBe('18500');
  });

  it('deriva o endereço do nome quando o arquivo não traz slug', () => {
    const entry = readProductEntry({ name: 'Perfume Árabe 100ml' });

    expect(entry.slug).toBe('perfume-arabe-100ml');
    expect(entry.candidate.slug).toBe('perfume-arabe-100ml');
  });

  it('da um nome a entrada que não tem nome nenhum, para o relatório', () => {
    const entry = readProductEntry({ variants: [] });

    expect(entry.slug).toBe('(sem slug)');
  });

  it('descarta categoria que não e texto em vez de quebrar', () => {
    const entry = readProductEntry({ name: 'Asad', categorySlugs: ['arabes', 7, null] });

    expect(entry.categorySlugs).toEqual(['arabes']);
  });

  it('não leva sourceCatalog: o produto não tem onde guardar a origem', () => {
    const { candidate } = readProductEntry({
      name: 'Asad',
      sourceCatalog: 'AM Atacadista - Originais',
    });

    expect('sourceCatalog' in candidate).toBe(false);
  });
});

describe('readCategoryEntry', () => {
  it('lê a mãe, e trata a raiz como raiz', () => {
    expect(readCategoryEntry({ slug: 'perfumes', parentSlug: null }).parentSlug).toBeNull();
    expect(
      readCategoryEntry({ slug: 'arabes', parentSlug: 'perfumes' }).parentSlug,
    ).toBe('perfumes');
  });

  it('manda o slug explicito, para a próxima importação achar a mesma linha', () => {
    // Sem ele o hook do schema geraria o endereço a partir do nome, e a chave
    // da idempotência deixaria de ser previsível.
    const entry = readCategoryEntry({ name: 'Árabes Masculinos' });

    expect(entry.candidate.slug).toBe('arabes-masculinos');
  });
});
