// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminReadyToShipPage from './admin-ready-to-ship-page';

/**
 * A prateleira.
 *
 * O que estes casos cobram:
 *
 * - **o recorte nao vem do endereco**: `readyToShip` e a tela, e precisa
 *   viajar em toda consulta;
 * - **tirar da prateleira tira a linha da lista**, com o caminho de volta no
 *   aviso — sem ele, um clique errado numa conferencia de vinte caixas nao
 *   teria como ser desfeito;
 * - **o cruzamento que so esta tela enxerga**: na prateleira e fora do ar;
 * - **o STAFF confere, e nao mexe.**
 */

const PRODUCTS = [
  {
    id: 'p1',
    name: 'Asad 100ml',
    slug: 'asad-100ml',
    brand: 'Lattafa',
    categoryIds: ['c1'],
    images: [],
    imageUrls: [],
    variants: [],
    hasVariants: false,
    priceRangeCents: { min: 24_900, max: 24_900 },
    totalStock: 4,
    isActive: true,
    isFeatured: false,
    isReadyToShip: true,
    tags: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'p2',
    name: 'Yara 100ml',
    slug: 'yara-100ml',
    brand: 'Lattafa',
    categoryIds: ['c1'],
    images: [],
    imageUrls: [],
    variants: [],
    hasVariants: false,
    priceRangeCents: { min: 21_900, max: 21_900 },
    totalStock: 2,
    // Na prateleira e fora do ar: a caixa esta na loja e ninguem compra.
    isActive: false,
    isFeatured: false,
    isReadyToShip: true,
    tags: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
];

let calls: { url: string; method: string; body: string }[] = [];
let items = PRODUCTS;

type Product = (typeof PRODUCTS)[number];
type Patch = Partial<Product>;

/** O `PATCH` do produto, aplicado no catalogo que o mock guarda. */
function applyPatch(product: Product, id: string, patch: Patch): Product {
  return product.id === id ? { ...product, ...patch } : product;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  items = PRODUCTS;

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : '' });

      if (url.includes('/admin/categories')) {
        return Promise.resolve(jsonResponse([]));
      }

      if (method === 'GET') {
        // O recorte e do servidor, e o teste depende disso: e a refetch
        // depois do `PATCH` que confirma que a linha saiu de verdade, e nao
        // so da tela.
        const visible = url.includes('readyToShip=true')
          ? items.filter((product) => product.isReadyToShip)
          : items;

        return Promise.resolve(
          jsonResponse({
            items: visible,
            page: 1,
            totalPages: 1,
            totalItems: visible.length,
            hasMore: false,
          }),
        );
      }

      const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Patch;
      const id = url.slice(url.lastIndexOf('/') + 1);

      items = items.map((product) => applyPatch(product, id, patch));

      return Promise.resolve(
        jsonResponse(items.find((product) => product.id === id) ?? PRODUCTS[0]),
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  useAdminSession.getState().signOut();
  vi.unstubAllGlobals();
});

function signInAs(role: UserRole): void {
  const user: AdminUser = {
    id: 'u1',
    name: 'Rayane Souza',
    email: 'rayane@maisonessence.test',
    role,
    isActive: true,
    mustChangePassword: false,
    credentialVersion: 1,
    lastLoginAt: null,
  };

  useAdminSession.getState().signIn(user, { accessToken: 'token', refreshToken: 'refresh' });
}

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [{ path: '/admin/pronta-entrega', Component: AdminReadyToShipPage }],
    { initialEntries: ['/admin/pronta-entrega'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function lastWrite(): { url: string; method: string; body: string } | undefined {
  return calls.findLast((call) => call.method !== 'GET');
}

/* ---- O recorte ---------------------------------------------------------------- */

test('a consulta sempre pede só a prateleira', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('link', { name: 'Asad 100ml' });

  // `readyToShip` nao vem do endereco: ele e a tela. Sem viajar, a lista
  // seria o catalogo inteiro com outro titulo.
  const listagem = calls.find((call) => call.url.includes('/admin/products'));

  expect(listagem?.url).toContain('readyToShip=true');
});

test('buscar mantem o recorte da prateleira', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('link', { name: 'Asad 100ml' });

  await user.type(screen.getByRole('searchbox', { name: 'Buscar na prateleira' }), 'yara');

  await waitFor(() => {
    const busca = calls.findLast((call) => call.url.includes('/admin/products'));

    expect(busca?.url).toContain('q=yara');
    expect(busca?.url).toContain('readyToShip=true');
  });
});

/* ---- O que so esta tela enxerga ------------------------------------------------- */

test('avisa o que esta na prateleira e fora do ar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  expect(await screen.findByText(/Yara 100ml esta na prateleira e fora do ar/)).toBeDefined();
});

/* ---- Tirar da prateleira --------------------------------------------------------- */

test('tirar da prateleira manda só a marca, e a linha some', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('link', { name: 'Asad 100ml' });

  await user.click(screen.getByRole('button', { name: 'Ações de Asad 100ml' }));
  await user.click(screen.getByRole('button', { name: 'Tirar da pronta entrega' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/products/p1');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ isReadyToShip: false });
  });

  // A lista mostra so o que esta na prateleira: manter a linha com a marca
  // desligada seria a tela discordando do proprio recorte.
  expect(screen.queryByRole('link', { name: 'Asad 100ml' })).toBeNull();
});

test('o aviso oferece o caminho de volta', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('link', { name: 'Asad 100ml' });

  await user.click(screen.getByRole('button', { name: 'Ações de Asad 100ml' }));
  await user.click(screen.getByRole('button', { name: 'Tirar da pronta entrega' }));

  await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ isReadyToShip: true });
  });
});

/* ---- O STAFF ---------------------------------------------------------------------- */

test('o STAFF confere a prateleira, e não mexe nela', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  // A pergunta que ele responde no WhatsApp e "tem para levar hoje?", e ela
  // se responde com a lista.
  expect(await screen.findByRole('link', { name: 'Asad 100ml' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Ações de Asad 100ml' })).toBeNull();
});

/* ---- A prateleira vazia ------------------------------------------------------------ */

test('a prateleira vazia explica onde se poe um produto nela', async () => {
  items = [];

  signInAs(USER_ROLES.OWNER);

  abrir();

  expect(await screen.findByRole('heading', { name: 'A prateleira esta vazia' })).toBeDefined();
  expect(screen.getByText(/A marca fica no cadastro do produto/)).toBeDefined();
});
