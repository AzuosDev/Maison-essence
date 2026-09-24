// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCart } from '@/features/cart';
import { StoreSettingsProvider } from '@/features/settings';
import { CartDrawer } from './cart-drawer';

/**
 * A gaveta da sacola.
 *
 * Três coisas que só se veem com ela montada: que ela **não** monta nada
 * enquanto esta fechada — e portanto não cota o carrinho em toda página da
 * loja —, que ela desenha a linha com o que a cotação devolveu, e que as
 * duas saídas existem e fazem coisas diferentes.
 */

vi.mock('@/lib/env', () => ({
  env: {
    VITE_API_URL: 'https://api.maisonessence.test/api/v1',
    VITE_CLOUDINARY_CLOUD_NAME: 'maison',
  },
}));

const CONFIGURACOES = {
  storeName: 'Maison Essence',
  whatsappNumber: '',
  whatsappLink: '',
  announcementText: '',
  contactEmail: '',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: true,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

const COTACAO = {
  items: [
    {
      productId: 'p1',
      variantId: 'v50',
      productName: 'Asad',
      productSlug: 'asad-lattafa',
      variantLabel: '50ml',
      image: 'produtos/asad-50',
      quantity: 2,
      unitPriceCents: 18990,
      availableStock: 8,
      allowBackorder: false,
      discountPercent: 0,
      discountCents: 0,
      lineTotalCents: 37980,
      unavailable: false,
      unavailableReason: '',
    },
  ],
  fulfillment: {
    mode: 'pickup',
    cityId: null,
    cityName: '',
    state: '',
    estimatedDays: 0,
    requiresAddress: false,
    feeCents: 0,
    isFree: true,
    freeReason: 'Retirada na loja',
    missingForFreeCents: null,
  },
  payment: { method: 'card', installments: 1, selected: null },
  subtotalCents: 37980,
  discountTotalCents: 0,
  deliveryFeeCents: 0,
  pixDiscountCents: 0,
  totalCents: 37980,
  installmentOptions: [],
  warnings: [],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

let quoteCalls = 0;

beforeEach(() => {
  localStorage.clear();
  quoteCalls = 0;
  useCart.setState({ lines: [], hints: {}, drawerOpen: false });

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/cart/quote')) {
        quoteCalls += 1;

        return Promise.resolve(jsonResponse(COTACAO));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIGURACOES));
      }

      return Promise.resolve(jsonResponse([]));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <StoreSettingsProvider>
          <MemoryRouter>
            <CartDrawer />
          </MemoryRouter>
        </StoreSettingsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function comUmItem() {
  useCart.setState({
    lines: [{ productId: 'p1', variantId: 'v50', quantity: 2 }],
    hints: { 'p1:v50': { name: 'Asad', slug: 'asad-lattafa', variantLabel: '50ml', image: '' } },
  });
}

test('fechada, a gaveta não desenha nada e não cota o carrinho', async () => {
  comUmItem();
  montar();

  expect(screen.queryByRole('dialog')).toBeNull();

  // Uma espera curta para garantir que nenhuma cotação saiu atrasada.
  await waitFor(() => {
    expect(quoteCalls).toBe(0);
  });
});

test('aberta, mostra o item, o subtotal do servidor e as duas saídas', async () => {
  comUmItem();
  useCart.setState({ drawerOpen: true });

  montar();

  // A gaveta entra por `lazy`: o diálogo aparece quando o pedaço chega.
  const gaveta = await screen.findByRole('dialog');

  // O nome e um link para o produto, e não só texto: da sacola se volta ao
  // que se escolheu.
  expect(within(gaveta).getByRole('link', { name: 'Asad' }).getAttribute('href')).toBe(
    '/produtos/asad-lattafa',
  );

  expect(within(gaveta).getByText('50ml')).toBeTruthy();

  // O "Remover" carrega o nome do item para quem ouve a página: numa sacola
  // de seis, seis botões chamados só "Remover" não dizem qual e qual.
  expect(within(gaveta).getByRole('button', { name: /Remover\s+Asad/ })).toBeTruthy();

  // 2 x R$ 189,90 = R$ 379,80, e o número vem da cotação — a tela não
  // multiplica nada. Conferido na linha do subtotal, e não em qualquer
  // "R$" da gaveta: o valor da linha mostra o mesmo número, e um
  // `getByText` solto passaria encontrando o outro.
  await waitFor(() => {
    const subtotal = within(gaveta).getByText('Subtotal').parentElement as HTMLElement;

    expect(within(subtotal).getByText('R$ 379,80')).toBeTruthy();
  });

  // Dois botões, e o link para a sacola inteira como destino.
  expect(within(gaveta).getByRole('button', { name: 'Finalizar compra' })).toBeTruthy();
  expect(within(gaveta).getByRole('button', { name: 'Continuar comprando' })).toBeTruthy();
  expect(
    within(gaveta).getByRole('link', { name: 'Ver a sacola inteira' }).getAttribute('href'),
  ).toBe('/sacola');
});

test('"continuar comprando" fecha a gaveta e não esvazia a sacola', async () => {
  const usuario = userEvent.setup();

  comUmItem();
  useCart.setState({ drawerOpen: true });

  montar();

  const gaveta = await screen.findByRole('dialog');

  await usuario.click(within(gaveta).getByRole('button', { name: 'Continuar comprando' }));

  expect(useCart.getState().drawerOpen).toBe(false);
  expect(useCart.getState().lines).toHaveLength(1);
});

test('a gaveta vazia oferece o catálogo em vez de um total', async () => {
  useCart.setState({ drawerOpen: true });

  montar();

  const gaveta = await screen.findByRole('dialog');

  expect(within(gaveta).getByText('Sua sacola esta vazia')).toBeTruthy();
  expect(within(gaveta).queryByRole('button', { name: 'Finalizar compra' })).toBeNull();
  expect(quoteCalls).toBe(0);
});
