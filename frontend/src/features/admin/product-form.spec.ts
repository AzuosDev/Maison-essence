import { expect, test } from 'vitest';
import type { AdminProduct } from './admin.types';
import {
  draftFromProduct,
  draftToCreate,
  draftToUpdate,
  duplicateVariant,
  emptyProductDraft,
  hasErrors,
  moveImage,
  newVariant,
  removeImage,
  setCover,
  validateDraft,
  type ProductDraft,
} from './product-form';

/**
 * O cadastro do produto.
 *
 * O que estes casos cobram e o que erra em silencio: um preco lido um centavo
 * errado, uma variante duplicada que rouba o SKU da original, uma capa que
 * troca sem ninguem pedir, um campo opcional que viaja vazio e derruba a
 * gravacao inteira. Nenhum deles quebra a tela — todos entram no banco.
 */

function product(patch: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: 'p1',
    name: 'Asad',
    slug: 'asad',
    description: 'Amadeirado.',
    brand: 'Lattafa',
    categoryIds: ['c1'],
    images: ['maison-essence/products/asad-1', 'maison-essence/products/asad-2'],
    coverImage: 'maison-essence/products/asad-1',
    variants: [
      {
        id: 'v1',
        sku: 'ASA-100',
        label: '100ml',
        priceCents: 18_990,
        compareAtPriceCents: 24_990,
        discountPercent: 24,
        stock: 4,
        image: '',
        isActive: true,
        allowBackorder: false,
        isAvailable: true,
      },
    ],
    hasVariants: true,
    priceRangeCents: { min: 18_990, max: 18_990 },
    discountPercent: 24,
    inStock: true,
    totalStock: 4,
    isActive: true,
    isFeatured: false,
    isReadyToShip: true,
    tags: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

/** Um rascunho valido, para os casos que mexem em um campo so. */
function draft(patch: Partial<ProductDraft> = {}): ProductDraft {
  return {
    ...emptyProductDraft(),
    name: 'Asad',
    variants: [{ ...newVariant(), label: '100ml', price: '189,90' }],
    ...patch,
  };
}

/* ---- Abrir um cadastro salvo ---------------------------------------------- */

test('o preco salvo volta como texto editavel', () => {
  const opened = draftFromProduct(product());

  expect(opened.variants[0]?.price).toBe('189,90');
  expect(opened.variants[0]?.compareAtPrice).toBe('249,90');
  expect(opened.variants[0]?.stock).toBe('4');
});

test('sem preco de comparacao o campo fica vazio, e nao zerado', () => {
  // `0,00` seria lido de volta como um desconto de 100%.
  const opened = draftFromProduct(
    product({ variants: [{ ...product().variants[0]!, compareAtPriceCents: null }] }),
  );

  expect(opened.variants[0]?.compareAtPrice).toBe('');
});

test('o cadastro novo ja vem com uma variante', () => {
  // Produto sem variante nao existe no dominio: o servidor recusa com 422, e
  // abrir a tabela vazia ensinaria a dona a descobrir isso ao salvar.
  expect(emptyProductDraft().variants).toHaveLength(1);
});

/* ---- Duplicar --------------------------------------------------------------- */

test('duplicar copia o trabalho e descarta a identidade', () => {
  const original = { ...newVariant(), id: 'v1', sku: 'ASA-100', label: '100ml', price: '189,90' };
  const copy = duplicateVariant(original);

  // O que se repete: o trabalho.
  expect(copy.price).toBe('189,90');
  expect(copy.label).toBe('100ml');

  // O que nao se repete: o que e unico por variante.
  expect(copy.id).toBeUndefined();
  expect(copy.sku).toBe('');
  expect(copy.key).not.toBe(original.key);
});

test('a chave de linha e sempre nova', () => {
  const keys = [newVariant().key, newVariant().key, duplicateVariant(newVariant()).key];

  expect(new Set(keys).size).toBe(3);
});

/* ---- As fotos ---------------------------------------------------------------- */

test('definir a capa e levar a foto para a primeira posicao', () => {
  // Nao ha campo de capa: a ordem do array e a ordem de exibicao, e a
  // primeira e a capa.
  expect(setCover(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
});

test('mover a foto reordena sem perder nenhuma', () => {
  expect(moveImage(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  expect(moveImage(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
});

test('um movimento impossivel devolve a lista como esta', () => {
  expect(moveImage(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  expect(moveImage(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  expect(moveImage(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
});

test('remover tira so a escolhida', () => {
  expect(removeImage(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
});

/* ---- A validacao --------------------------------------------------------------- */

test('um rascunho completo passa', () => {
  expect(hasErrors(validateDraft(draft()))).toBe(false);
});

test('o nome curto demais barra', () => {
  expect(validateDraft(draft({ name: 'A' })).name).toBeDefined();
});

test('preco em branco barra a variante, e nao o produto', () => {
  const current = draft({ variants: [{ ...newVariant(), price: '' }] });
  const errors = validateDraft(current);

  expect(errors.name).toBeUndefined();
  expect(errors.variant[current.variants[0]!.key]?.price).toBeDefined();
});

test('o preco de comparacao precisa ser maior que o preco', () => {
  // Menor, ele desenharia um desconto negativo no card da vitrine.
  const current = draft({
    variants: [{ ...newVariant(), price: '189,90', compareAtPrice: '99,90' }],
  });

  expect(validateDraft(current).variant[current.variants[0]!.key]?.price).toBeDefined();
});

test('duas variantes com o mesmo nome barram as duas', () => {
  const a = { ...newVariant(), label: '100ml', price: '189,90' };
  const b = { ...newVariant(), label: '100 ML', price: '189,90' };
  const errors = validateDraft(draft({ variants: [a, b] }));

  // A comparacao ignora caixa e espaco nas pontas: "100ml" e "100 ML" sao a
  // mesma variante para quem le a vitrine.
  expect(errors.variant[a.key]?.label).toBeDefined();
  expect(errors.variant[b.key]?.label).toBeDefined();
});

test('SKU repetido barra, mas dois SKUs em branco nao', () => {
  const a = { ...newVariant(), label: '50ml', sku: 'ASA', price: '99,90' };
  const b = { ...newVariant(), label: '100ml', sku: 'asa', price: '189,90' };

  expect(validateDraft(draft({ variants: [a, b] })).variant[a.key]?.sku).toBeDefined();

  // Em branco, o servidor gera um para cada — nao ha conflito a anunciar.
  const c = { ...newVariant(), label: '50ml', price: '99,90' };
  const d = { ...newVariant(), label: '100ml', price: '189,90' };

  expect(validateDraft(draft({ variants: [c, d] })).variant[c.key]?.sku).toBeUndefined();
});

test('estoque em branco barra; zero passa', () => {
  const zero = draft({ variants: [{ ...newVariant(), price: '10,00', stock: '0' }] });
  const blank = draft({ variants: [{ ...newVariant(), price: '10,00', stock: '' }] });

  expect(hasErrors(validateDraft(zero))).toBe(false);
  expect(validateDraft(blank).variant[blank.variants[0]!.key]?.stock).toBeDefined();
});

test('produto sem nenhuma variante barra', () => {
  expect(validateDraft(draft({ variants: [] })).variants).toBeDefined();
});

/* ---- A saida ------------------------------------------------------------------- */

test('o preco digitado vira centavos exatos', () => {
  // `19.99 * 100` daria `1998.9999...`, e o produto entraria um centavo mais
  // barato. Este caso existe por isso.
  const body = draftToUpdate(draft({ variants: [{ ...newVariant(), price: '19,99' }] }));

  expect(body.variants?.[0]?.priceCents).toBe(1999);
});

test('o preco de comparacao em branco vira null, e nao zero', () => {
  const body = draftToUpdate(draft({ variants: [{ ...newVariant(), price: '10,00' }] }));

  expect(body.variants?.[0]?.compareAtPriceCents).toBeNull();
});

test('o SKU e o id em branco nao viajam', () => {
  const body = draftToUpdate(draft({ variants: [{ ...newVariant(), price: '10,00' }] }));
  const variant = body.variants?.[0] ?? {};

  // Ausente faz o servidor gerar o SKU e criar a variante. Presente e vazio
  // seria outra coisa: um SKU em branco, que o validador recusa.
  expect('sku' in variant).toBe(false);
  expect('id' in variant).toBe(false);
});

test('o endereco so entra na criacao quando foi escrito', () => {
  expect('slug' in draftToCreate(draft())).toBe(false);
  expect(draftToCreate(draft({ slug: 'asad-elixir' })).slug).toBe('asad-elixir');
});

test('a edicao nunca manda o endereco', () => {
  // O link ja foi para o WhatsApp de alguem: troca-lo e outra operacao.
  expect('slug' in draftToUpdate(draft({ slug: 'asad-elixir' }))).toBe(false);
});

test('o que foi salvo e reaberto sai igual', () => {
  const saved = product();
  const body = draftToUpdate(draftFromProduct(saved));

  expect(body.name).toBe(saved.name);
  expect(body.images).toEqual(saved.images);
  expect(body.variants?.[0]?.priceCents).toBe(saved.variants[0]?.priceCents);
  expect(body.variants?.[0]?.compareAtPriceCents).toBe(saved.variants[0]?.compareAtPriceCents);
  expect(body.variants?.[0]?.id).toBe(saved.variants[0]?.id);
});
