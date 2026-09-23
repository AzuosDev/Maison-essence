// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCart } from '@/features/cart';
import type { PublicProduct, PublicVariant } from '@/features/catalog';
import { ProductCard } from './product-card';

/**
 * O card de produto contra dados de verdade.
 *
 * O que estes casos cobrem e o comportamento que o mockup nao consegue
 * mostrar: o que acontece no clique. Um card que desenha certo e poe a
 * variante errada na sacola parece perfeito na revisao visual.
 */

const REGRAS_DE_PAGAMENTO = {
  pix: null,
  card: {
    maxInstallments: 12,
    interestFreeUpTo: 6,
    monthlyInterestPercent: 1.99,
    minInstallmentCents: 2000,
  },
};

function variante(overrides: Partial<PublicVariant> = {}): PublicVariant {
  return {
    id: 'v1',
    label: '',
    priceCents: 18000,
    compareAtPriceCents: null,
    discountPercent: 0,
    stock: 4,
    isAvailable: true,
    onDemand: false,
    image: '',
    ...overrides,
  };
}

function produto(overrides: Partial<PublicProduct> = {}): PublicProduct {
  const variants = overrides.variants ?? [variante()];
  const precos = variants.map((item) => item.priceCents);

  return {
    id: 'p1',
    name: 'Asad',
    slug: 'asad-lattafa',
    brand: 'Lattafa',
    images: ['produtos/asad'],
    coverImage: 'produtos/asad',
    hasVariants: variants.length > 1,
    priceRangeCents: { min: Math.min(...precos), max: Math.max(...precos) },
    discountPercent: 0,
    inStock: variants.some((item) => item.isAvailable),
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    quantityDiscount: null,
    ...overrides,
    variants,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  // A sacola e persistida em `localStorage` e sobreviveria de um caso para o
  // outro: sem isto, o segundo teste comecaria com o item do primeiro.
  useCart.setState({ lines: [] });

  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(REGRAS_DE_PAGAMENTO))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(item: PublicProduct) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <ProductCard product={item} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

test('produto de variante unica vai direto para a sacola', async () => {
  const user = userEvent.setup();

  montar(produto());

  await user.click(screen.getByRole('button', { name: 'Adicionar' }));

  expect(useCart.getState().lines).toEqual([
    expect.objectContaining({ productId: 'p1', variantId: 'v1', quantity: 1 }),
  ]);
});

test('produto de varias variantes abre o seletor antes de adicionar', async () => {
  const user = userEvent.setup();

  montar(
    produto({
      variants: [
        variante({ id: 'v50', label: '50ml', priceCents: 18000 }),
        variante({ id: 'v100', label: '100ml', priceCents: 26000 }),
      ],
    }),
  );

  await user.click(screen.getByRole('button', { name: 'Ver opcoes' }));

  const dialogo = await screen.findByRole('dialog');

  // Nada entrou na sacola so por abrir o seletor.
  expect(useCart.getState().lines).toHaveLength(0);

  await user.click(within(dialogo).getByRole('radio', { name: /100ml/ }));
  await user.click(within(dialogo).getByRole('button', { name: 'Adicionar a sacola' }));

  // A linha guardada tem tres campos e nenhum deles e texto: o rotulo da
  // opcao — como o nome e a foto — vive na dica em memoria, fora do
  // `localStorage`. Conferir os dois lados e o que garante que a variante
  // certa foi escolhida *e* que a linha continua sem nada alem dos ids.
  expect(useCart.getState().lines).toEqual([
    { productId: 'p1', variantId: 'v100', quantity: 1 },
  ]);

  expect(useCart.getState().hints['p1:v100']).toEqual(
    expect.objectContaining({ variantLabel: '100ml', name: 'Asad' }),
  );
});

test('o card precifica pela variante mais barata', () => {
  montar(
    produto({
      variants: [
        variante({ id: 'v100', label: '100ml', priceCents: 26000 }),
        variante({ id: 'v50', label: '50ml', priceCents: 18000 }),
      ],
    }),
  );

  // Faixa, e nao o preco da primeira variante da lista.
  expect(screen.getByText(/R\$ 180,00 – R\$ 260,00/)).toBeDefined();
});

test('o preco riscado aparece quando ha compareAtPrice', () => {
  montar(
    produto({
      discountPercent: 25,
      variants: [variante({ priceCents: 18000, compareAtPriceCents: 24000 })],
    }),
  );

  expect(screen.getByText(/R\$ 240,00/)).toBeDefined();
  expect(screen.getByText('-25%')).toBeDefined();
});

test('o preco riscado some quando o produto tem faixa de preco', () => {
  montar(
    produto({
      variants: [
        variante({ id: 'v50', label: '50ml', priceCents: 18000, compareAtPriceCents: 24000 }),
        variante({ id: 'v100', label: '100ml', priceCents: 26000 }),
      ],
    }),
  );

  // "De R$ 240,00" ao lado de uma faixa nao diria a qual opcao se refere.
  expect(screen.queryByText(/R\$ 240,00/)).toBeNull();
});

test('produto de pronta entrega leva o selo verde', () => {
  montar(produto({ isReadyToShip: true }));

  expect(screen.getByText('Pronta entrega')).toBeDefined();
});

test('produto esgotado mostra o selo e nao deixa adicionar', () => {
  montar(
    produto({
      variants: [variante({ stock: 0, isAvailable: false })],
    }),
  );

  const botao = screen.getByRole('button', { name: 'Esgotado' });

  expect(botao.hasAttribute('disabled')).toBe(true);
});

test('a chamada de desconto progressivo aparece quando o produto tem regra', () => {
  montar(produto({ quantityDiscount: { minQty: 3, percentOff: 10 } }));

  expect(screen.getByText('Leve 3 e ganhe 10%')).toBeDefined();
});

test('a linha de parcelamento usa as regras que a loja cadastrou', async () => {
  montar(produto());

  // R$ 180 em 6x sem juros, o teto da loja, da R$ 30 por parcela.
  expect(await screen.findByText(/6x de R\$ 30,00/)).toBeDefined();
});
