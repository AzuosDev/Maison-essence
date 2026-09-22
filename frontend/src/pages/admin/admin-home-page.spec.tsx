// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AdminLayout } from '@/app/layouts';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminHomePage from './admin-home-page';

/**
 * A abertura do painel, com papel de verdade.
 *
 * O que estes casos cobram e o criterio de aceite: **o STAFF nao ve preco**.
 * Nao e uma classe de CSS a conferir — e a ausencia do card de faturamento,
 * a ausencia da coluna de total e a ausencia dos itens de menu que levariam
 * ao catalogo.
 *
 * A sessao e escrita direto no store, e nao por um login simulado: o que
 * esta em teste e o recorte por papel, e nao a tela de entrada.
 */

const ORDERS = {
  items: [
    {
      id: 'o1',
      code: 'ME-260922-K4P1',
      status: 'PENDING_CONTACT',
      customerName: 'Rayane Alves',
      phone: '88999998888',
      phoneLabel: '(88) 99999-8888',
      mode: 'DELIVERY',
      itemCount: 2,
      totalCents: 37_980,
      createdAt: '2026-09-22T12:00:00.000Z',
    },
  ],
  page: 1,
  totalPages: 1,
  totalItems: 1,
  hasMore: false,
};

const PRODUCTS = {
  items: [
    {
      id: 'p1',
      name: 'Asad',
      slug: 'asad',
      description: '',
      brand: 'Lattafa',
      categoryIds: [],
      images: [],
      coverImage: '',
      variants: [
        {
          id: 'v1',
          sku: 'ASA-100',
          label: '100ml',
          priceCents: 18_990,
          compareAtPriceCents: null,
          discountPercent: 0,
          stock: 2,
          image: '',
          isActive: true,
          allowBackorder: false,
          isAvailable: true,
        },
      ],
      hasVariants: true,
      priceRangeCents: { min: 18_990, max: 18_990 },
      discountPercent: 0,
      inStock: true,
      totalStock: 2,
      isActive: true,
      isFeatured: false,
      isReadyToShip: true,
      tags: [],
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
    },
  ],
  page: 1,
  totalPages: 1,
  totalItems: 1,
  hasMore: false,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  // O jsdom nao tem `matchMedia`, e sem ele o painel se desenha como celular:
  // a coluna vira gaveta fechada, e o menu nao existe no documento. Como o
  // que esta em teste e o recorte por papel — e ele aparece no menu —, a
  // tela e montada na largura de desktop.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/admin/orders')) {
        return Promise.resolve(jsonResponse(ORDERS));
      }

      if (url.includes('/admin/products')) {
        return Promise.resolve(jsonResponse(PRODUCTS));
      }

      return Promise.resolve(jsonResponse({ items: [], page: 1, totalPages: 1, totalItems: 0 }));
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

function abrirPainel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        Component: AdminLayout,
        children: [{ index: true, Component: AdminHomePage }],
      },
      { path: '/admin/entrar', element: <p>Tela de entrada</p> },
      { path: '/admin/trocar-senha', element: <p>Troque a senha</p> },
    ],
    { initialEntries: ['/admin'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('sem sessao, o painel manda para a entrada', () => {
  abrirPainel();

  expect(screen.getByText('Tela de entrada')).toBeDefined();
});

test('com senha temporaria, o painel manda trocar antes de qualquer coisa', () => {
  const user: AdminUser = {
    id: 'u1',
    name: 'Rayane',
    email: 'rayane@maisonessence.test',
    role: USER_ROLES.OWNER,
    isActive: true,
    mustChangePassword: true,
    credentialVersion: 1,
    lastLoginAt: null,
  };

  useAdminSession.getState().signIn(user, { accessToken: 'token', refreshToken: 'refresh' });

  abrirPainel();

  expect(screen.getByText('Troque a senha')).toBeDefined();
});

test('a dona ve o menu inteiro, o faturamento e o total do pedido', async () => {
  signInAs(USER_ROLES.OWNER);

  abrirPainel();

  expect(await screen.findByRole('link', { name: /Faturamento do mes/ })).toBeDefined();

  const menu = screen.getByRole('navigation', { name: 'Areas do painel' });

  expect(within(menu).getByRole('link', { name: 'Produtos' })).toBeDefined();
  expect(within(menu).getByRole('link', { name: 'Configuracoes' })).toBeDefined();

  // O total do pedido na lista.
  expect(await screen.findByText('R$ 379,80')).toBeDefined();
});

test('o STAFF nao ve preco em lugar nenhum da abertura', async () => {
  signInAs(USER_ROLES.STAFF);

  abrirPainel();

  // A lista carrega: e depois dela que a ausencia do valor significa algo.
  expect(await screen.findByText('ME-260922-K4P1')).toBeDefined();

  expect(screen.queryByText(/Faturamento do mes/)).toBeNull();
  expect(screen.queryByText('R$ 379,80')).toBeNull();
  expect(screen.queryByText(/Sem estoque/)).toBeNull();
});

test('o menu do STAFF tem duas areas', () => {
  signInAs(USER_ROLES.STAFF);

  abrirPainel();

  const menu = screen.getByRole('navigation', { name: 'Areas do painel' });

  expect(within(menu).getAllByRole('link')).toHaveLength(2);
  expect(within(menu).getByRole('link', { name: 'Pedidos' })).toBeDefined();
  expect(within(menu).queryByRole('link', { name: 'Produtos' })).toBeNull();
});

test('o pedido esperando contato acende o card de alerta', async () => {
  signInAs(USER_ROLES.OWNER);

  abrirPainel();

  // `findByText` e nao `findByRole`: o card aparece antes da resposta, com um
  // tracinho no lugar do numero. O que esta em teste e o que ele diz **depois**
  // de saber que ha um pedido parado.
  expect(await screen.findByText(/Abra a conversa/)).toBeDefined();

  const card = screen.getByRole('link', { name: /Esperando contato/ });

  expect(card.textContent).toContain('1');
});
