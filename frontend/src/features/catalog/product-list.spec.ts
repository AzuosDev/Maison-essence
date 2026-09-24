import { expect, test } from 'vitest';
import { brandsOf, ceilingOf, pagedSlice, saleSlice } from './product-list';
import type { Paginated, PublicProduct } from './catalog.types';

/**
 * A montagem da lista.
 *
 * Dois comportamentos merecem caso próprio. O acumulo do celular — que e o
 * que sustenta "voltar do produto preserva a página carregada", porque a
 * volta remonta as mesmas páginas do cache — e o recorte do filtro de
 * desconto, que existe só porque a API não tem esse filtro e portanto e o
 * pedaço mais fácil de errar em silêncio.
 */

function produto(id: string, patch: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id,
    name: `Produto ${id}`,
    slug: `produto-${id}`,
    brand: 'Lattafa',
    images: [],
    coverImage: '',
    variants: [],
    hasVariants: false,
    priceRangeCents: { min: 10_000, max: 10_000 },
    discountPercent: 0,
    inStock: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    quantityDiscount: null,
    ...patch,
  };
}

function pagina(items: PublicProduct[], patch: Partial<Paginated<PublicProduct>> = {}) {
  return {
    items,
    page: 1,
    totalPages: 3,
    totalItems: 60,
    hasMore: true,
    ...patch,
  };
}

/* ---- Paginação normal --------------------------------------------------- */

test('as páginas do celular viram uma lista só, na ordem', () => {
  const lista = pagedSlice([
    pagina([produto('1'), produto('2')], { page: 1 }),
    pagina([produto('3')], { page: 2 }),
  ]);

  expect(lista.products.map((p) => p.id)).toEqual(['1', '2', '3']);
});

test('as totalizações saem da última página carregada', () => {
  // Se a dona publicar um produto entre um "carregar mais" e o seguinte, o
  // número mais novo e o mais próximo da verdade.
  const lista = pagedSlice([
    pagina([produto('1')], { totalItems: 60, hasMore: true }),
    pagina([produto('2')], { totalItems: 61, hasMore: false }),
  ]);

  expect(lista.totalItems).toBe(61);
  expect(lista.hasMore).toBe(false);
});

test('sem página nenhuma, a lista e vazia e não quebra', () => {
  expect(pagedSlice([]).products).toEqual([]);
  expect(pagedSlice([]).totalItems).toBe(0);
});

/* ---- O recorte do filtro de desconto ------------------------------------ */

test('a varredura descarta quem não tem desconto', () => {
  const varredura = [
    produto('1', { discountPercent: 30 }),
    produto('2', { discountPercent: 10 }),
    produto('3', { discountPercent: 0 }),
    produto('4', { discountPercent: 0 }),
  ];

  const lista = saleSlice(varredura, 1, false);

  expect(lista.products.map((p) => p.id)).toEqual(['1', '2']);
  expect(lista.totalItems).toBe(2);
});

test('a contagem do recorte e a dos descontados, e não a da varredura', () => {
  const varredura = [
    ...Array.from({ length: 30 }, (_, i) => produto(`d${String(i)}`, { discountPercent: 20 })),
    ...Array.from({ length: 18 }, (_, i) => produto(`s${String(i)}`)),
  ];

  const lista = saleSlice(varredura, 1, false);

  expect(lista.totalItems).toBe(30);
  expect(lista.totalPages).toBe(2);
  expect(lista.products).toHaveLength(24);
  expect(lista.hasMore).toBe(true);
});

test('a segunda página do recorte troca os itens no desktop', () => {
  const varredura = Array.from({ length: 30 }, (_, i) =>
    produto(String(i), { discountPercent: 20 }),
  );

  const segunda = saleSlice(varredura, 2, false);

  expect(segunda.products).toHaveLength(6);
  expect(segunda.products[0]?.id).toBe('24');
  expect(segunda.hasMore).toBe(false);
});

test('a segunda página do recorte acumula no celular', () => {
  const varredura = Array.from({ length: 30 }, (_, i) =>
    produto(String(i), { discountPercent: 20 }),
  );

  expect(saleSlice(varredura, 2, true).products).toHaveLength(30);
});

test('a varredura cheia de descontos avisa que pode ter ficado gente de fora', () => {
  // Quarenta e oito e o teto da página do backend. Vindo todos com desconto,
  // pode haver um quadragesimo nono que a varredura não alcancou — e a tela
  // diz isso em vez de apresentar uma contagem que talvez esteja errada.
  const cheia = Array.from({ length: 48 }, (_, i) => produto(String(i), { discountPercent: 15 }));

  expect(saleSlice(cheia, 1, false).truncated).toBe(true);
  expect(saleSlice(cheia.slice(0, 47), 1, false).truncated).toBe(false);
});

/* ---- As opções da barra de filtros -------------------------------------- */

test('as marcas saem sem repetir, ignorando a caixa, e em ordem', () => {
  const marcas = brandsOf([
    produto('1', { brand: 'Lattafa' }),
    produto('2', { brand: 'Armaf' }),
    // Mesma prateleira da loja, grafada de outro jeito no painel.
    produto('3', { brand: 'lattafa' }),
    produto('4', { brand: '' }),
  ]);

  expect(marcas).toEqual(['Armaf', 'Lattafa']);
});

test('o teto do slider e o maior preço da varredura', () => {
  const teto = ceilingOf([
    produto('1', { priceRangeCents: { min: 10_000, max: 10_000 } }),
    produto('2', { priceRangeCents: { min: 20_000, max: 45_000 } }),
  ]);

  expect(teto).toBe(45_000);
});

test('catálogo vazio não produz teto negativo', () => {
  expect(ceilingOf([])).toBe(0);
});
