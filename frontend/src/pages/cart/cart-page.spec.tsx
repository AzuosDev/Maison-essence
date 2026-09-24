// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCart } from '@/features/cart';
import { StoreSettingsProvider } from '@/features/settings';
import CartPage from './cart-page';

/**
 * A sacola contra a API.
 *
 * Os criterios de aceite escritos como codigo, e os tres sao do tipo que uma
 * revisao visual nao pega:
 *
 * 1. **Quem soma e o servidor.** Uma tela que multiplica preco por
 *    quantidade no navegador parece correta em qualquer captura e so erra no
 *    carrinho que ganhou desconto por quantidade — ou seja, no maior deles.
 *    O caso confere o que foi **pedido** ao servidor e o que foi **exibido**,
 *    e o total exibido e um numero que nenhuma conta local produziria.
 * 2. **A sacola sobrevive ao navegador fechado.** Testado no
 *    `localStorage`: o que foi gravado e o que volta.
 * 3. **O produto desativado aparece como indisponivel.** A segunda cotacao
 *    devolve a linha marcada, sem que ninguem tenha recarregado nada.
 */

vi.mock('@/lib/env', () => ({
  env: {
    VITE_API_URL: 'https://api.maisonessence.test/api/v1',
    VITE_CLOUDINARY_CLOUD_NAME: 'maison',
  },
}));

const CONFIGURACOES = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: '',
  contactEmail: '',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  // Ligada: e o que permite a cotacao sair sem escolher cidade nenhuma.
  pickupEnabled: true,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

/** Uma linha cotada, com os campos que a tela le. */
function itemCotado(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'p1',
    variantId: 'v50',
    productName: 'Asad',
    productSlug: 'asad-lattafa',
    variantLabel: '50ml',
    image: 'produtos/asad-50',
    quantity: 1,
    unitPriceCents: 18990,
    availableStock: 8,
    allowBackorder: false,
    discountPercent: 0,
    discountCents: 0,
    lineTotalCents: 18990,
    unavailable: false,
    unavailableReason: '',
    ...overrides,
  };
}

function cotacao(items: Record<string, unknown>[], totals: Record<string, unknown> = {}) {
  const subtotalCents = items.reduce(
    (total, item) => total + ((item.lineTotalCents as number | undefined) ?? 0),
    0,
  );

  return {
    items,
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
    subtotalCents,
    discountTotalCents: 0,
    deliveryFeeCents: 0,
    pixDiscountCents: 0,
    totalCents: subtotalCents,
    installmentOptions: [],
    warnings: [],
    ...totals,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** As cotacoes que o servidor vai devolver, em ordem. A ultima se repete. */
let quotesToServe: unknown[] = [];

/** Os corpos que a tela mandou para `POST /cart/quote`. */
let quoteRequests: { items: { variantId: string; quantity: number }[] }[] = [];

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ lines: [], hints: {}, drawerOpen: false });

  quotesToServe = [cotacao([itemCotado()])];
  quoteRequests = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/cart/quote')) {
        quoteRequests.push(JSON.parse(String(init?.body)));

        return Promise.resolve(
          jsonResponse(quotesToServe[Math.min(quoteRequests.length - 1, quotesToServe.length - 1)]),
        );
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIGURACOES));
      }

      if (url.includes('/pages')) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes('/delivery-cities')) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse(null));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

function abrirSacola() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  const router = createMemoryRouter([{ path: '/sacola', element: <CartPage /> }], {
    initialEntries: ['/sacola'],
  });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <StoreSettingsProvider>
          <RouterProvider router={router} />
        </StoreSettingsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function comUmItem(quantity = 1) {
  useCart.setState({
    lines: [{ productId: 'p1', variantId: 'v50', quantity }],
    hints: { 'p1:v50': { name: 'Asad', slug: 'asad-lattafa', variantLabel: '50ml', image: '' } },
  });
}

/** O total, lido do bloco de resumo e nao de qualquer "R$" da tela. */
async function totalExibido(): Promise<string> {
  const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });

  return within(resumo).getByText(/^R\$/, { selector: 'strong' }).textContent ?? '';
}

test('editar a quantidade recalcula o total pelo servidor, e nao pelo navegador', async () => {
  const usuario = userEvent.setup();

  comUmItem(1);

  // A segunda cotacao devolve um total que **nenhuma** conta local
  // produziria a partir da primeira: 3 x R$ 189,90 daria R$ 569,70, e o
  // servidor responde R$ 512,73 (10% de desconto por quantidade). Se a tela
  // estivesse multiplicando por conta propria, ela mostraria o numero
  // errado — e o teste falha.
  quotesToServe = [
    cotacao([itemCotado()]),
    cotacao([
      itemCotado({
        quantity: 3,
        discountPercent: 10,
        discountCents: 5697,
        lineTotalCents: 51273,
      }),
    ]),
  ];

  abrirSacola();

  await waitFor(async () => {
    expect(await totalExibido()).toBe('R$ 189,90');
  });

  await usuario.click(screen.getByRole('button', { name: 'Aumentar a quantidade' }));
  await usuario.click(screen.getByRole('button', { name: 'Aumentar a quantidade' }));

  await waitFor(
    async () => {
      expect(await totalExibido()).toBe('R$ 512,73');
    },
    { timeout: 3000 },
  );

  // E o servidor recebeu a quantidade nova.
  expect(quoteRequests.at(-1)?.items).toEqual([
    { productId: 'p1', variantId: 'v50', quantity: 3 },
  ]);
});

test('o debounce junta a rajada de cliques em uma cotacao so', async () => {
  const usuario = userEvent.setup();

  comUmItem(1);
  abrirSacola();

  await waitFor(() => {
    expect(quoteRequests).toHaveLength(1);
  });

  const mais = screen.getByRole('button', { name: 'Aumentar a quantidade' });

  await usuario.click(mais);
  await usuario.click(mais);
  await usuario.click(mais);

  await waitFor(
    () => {
      expect(quoteRequests.at(-1)?.items[0]?.quantity).toBe(4);
    },
    { timeout: 3000 },
  );

  // Quatro cliques, duas cotacoes: a da abertura e a do valor final. Sem o
  // atraso, seriam quatro.
  expect(quoteRequests.length).toBeLessThanOrEqual(2);
});

test('fechar e reabrir o navegador mantem os itens', () => {
  comUmItem(2);

  // O que atravessa o `localStorage` e o que uma nova aba vai encontrar.
  const guardado = JSON.parse(localStorage.getItem('maison-essence.cart') ?? '{}') as {
    state: { lines: unknown[] };
  };

  expect(guardado.state.lines).toEqual([{ productId: 'p1', variantId: 'v50', quantity: 2 }]);
});

/**
 * A regra que governa o modulo inteiro, conferida no armazenamento.
 *
 * Nao basta a tela mostrar o preco certo: ela nao pode ter deixado um preco
 * para tras. `18990` nao aparece em nada do que foi gravado.
 */
test('nenhum preco atravessa o localStorage', async () => {
  comUmItem(1);
  abrirSacola();

  await waitFor(async () => {
    expect(await totalExibido()).toBe('R$ 189,90');
  });

  const gravado = localStorage.getItem('maison-essence.cart') ?? '';

  expect(gravado).not.toContain('18990');
  expect(gravado).not.toContain('unitPriceCents');
  expect(gravado).not.toContain('Asad');
});

test('um produto desativado no painel aparece como indisponivel na sacola aberta', async () => {
  const usuario = userEvent.setup();

  comUmItem(1);

  // A primeira cotacao traz o item normal; a segunda — depois de a dona
  // desativar o produto — traz a mesma linha marcada. Ninguem recarregou a
  // pagina: foi a propria sacola que recotou ao mexer na quantidade.
  quotesToServe = [
    cotacao([itemCotado()]),
    cotacao([
      itemCotado({
        quantity: 2,
        lineTotalCents: 0,
        unavailable: true,
        unavailableReason: 'Este produto saiu do catalogo.',
      }),
    ]),
  ];

  abrirSacola();

  await waitFor(async () => {
    expect(await totalExibido()).toBe('R$ 189,90');
  });

  await usuario.click(screen.getByRole('button', { name: 'Aumentar a quantidade' }));

  // O aviso diz o que mudou, com o nome do produto e o motivo do servidor.
  const aviso = await screen.findByText('Um item saiu da sacola', undefined, { timeout: 3000 });
  const bloco = aviso.parentElement as HTMLElement;

  expect(within(bloco).getByText(/Este produto saiu do catalogo/)).toBeTruthy();

  // O item continua visivel — quem o escolheu precisa reconhece-lo para
  // decidir — e fora do total.
  expect(screen.getByText('Fora do total')).toBeTruthy();
  expect(await totalExibido()).toBe('R$ 0,00');

  // E ha como tira-lo dali.
  await usuario.click(within(bloco).getByRole('button', { name: 'Remover o item' }));

  expect(useCart.getState().lines).toHaveLength(0);
});

test('a sacola vazia oferece o caminho de volta ao catalogo', () => {
  abrirSacola();

  expect(screen.getByText('Sua sacola esta vazia')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ver os perfumes' }).getAttribute('href')).toBe(
    '/produtos',
  );

  // Sem itens, nenhuma cotacao e pedida: a rota recusa sacola vazia.
  expect(quoteRequests).toHaveLength(0);
});

test('a sacola fica fora do indice de busca', async () => {
  comUmItem(1);
  abrirSacola();

  await waitFor(() => {
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
  });
});
