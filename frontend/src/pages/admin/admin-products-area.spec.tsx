// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminProductFormPage from './admin-product-form-page';
import AdminProductsPage from './admin-products-page';

/**
 * A area de produtos do painel.
 *
 * O que estes casos cobram sao os criterios de aceite do prompt:
 *
 * - **o STAFF nao ve nem altera preco** — nem a coluna, nem o interruptor,
 *   nem o cadastro;
 * - **o recorte mora no endereco**, e chega a API como consulta filtrada;
 * - **o interruptor vira na hora** e manda o valor oposto ao servidor;
 * - **cadastrar um produto com variantes funciona**, e o corpo que sai tem os
 *   precos em centavos;
 * - **duplicar uma variante** copia o trabalho sem copiar o SKU;
 * - **excluir pede confirmacao nomeando o produto**.
 */

const CATEGORY_ID = '68d1f2a3c4b5e6f708192a3b';

const CATEGORIES = [
  {
    id: CATEGORY_ID,
    name: 'Masculino',
    slug: 'masculino',
    previousSlugs: [],
    parentId: null,
    image: '',
    order: 0,
    isActive: true,
    productCount: 3,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    children: [],
  },
];

const PRODUCT = {
  id: 'p1',
  name: 'Asad',
  slug: 'asad',
  description: 'Amadeirado.',
  brand: 'Lattafa',
  categoryIds: [CATEGORY_ID],
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
      stock: 4,
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
  totalStock: 4,
  isActive: true,
  isFeatured: false,
  isReadyToShip: true,
  tags: [],
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

const LIST = { items: [PRODUCT], page: 1, totalPages: 1, totalItems: 1, hasMore: false };

/** As chamadas que sairam, para os casos que perguntam o que foi pedido. */
let calls: { url: string; method: string; body: string }[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];

  // Sem `matchMedia` o jsdom desenha tudo como celular, e e na largura de
  // desktop que a tabela tem colunas — e nas colunas que a ausencia do preco
  // significa alguma coisa.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : '',
      });

      if (url.includes('/admin/categories')) {
        return Promise.resolve(jsonResponse(CATEGORIES));
      }

      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (init?.method === 'POST' || init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(PRODUCT));
      }

      if (/\/admin\/products\/[^?]+$/.test(url)) {
        return Promise.resolve(jsonResponse(PRODUCT));
      }

      return Promise.resolve(jsonResponse(LIST));
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

/** Monta as telas sem a moldura do painel: o guarda tem os casos dele. */
function abrir(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      { path: '/admin/produtos', Component: AdminProductsPage },
      { path: '/admin/produtos/novo', Component: AdminProductFormPage },
      { path: '/admin/produtos/:id', Component: AdminProductFormPage },
    ],
    { initialEntries: [path] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function lastListCall(): string {
  return (
    calls.findLast((call) => call.method === 'GET' && call.url.includes('/admin/products'))?.url ??
    ''
  );
}

function lastWrite(): { url: string; method: string; body: string } | undefined {
  return calls.findLast((call) => call.method === 'POST' || call.method === 'PATCH');
}

/* ---- A lista --------------------------------------------------------------- */

test('a dona vê o preço, a categoria e o interruptor', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos');

  expect(await screen.findByRole('link', { name: 'Asad' })).toBeDefined();
  expect(screen.getByText('R$ 189,90')).toBeDefined();

  // Na celula da tabela, e nao na opcao do filtro: as duas dizem "Masculino".
  await waitFor(() => {
    expect(within(screen.getByRole('table')).getByText('Masculino')).toBeDefined();
  });
  expect(screen.getByRole('switch', { name: 'Publicar Asad' })).toBeDefined();
});

test('o STAFF le o catalogo sem preço e sem poder mexer', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/produtos');

  expect(await screen.findByRole('link', { name: 'Asad' })).toBeDefined();

  // O estoque fica: e com ele que ele responde "tem o de 100 ml?".
  expect(screen.getByText('4')).toBeDefined();

  expect(screen.queryByText('R$ 189,90')).toBeNull();
  expect(screen.queryByRole('link', { name: /Adicionar produto/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Ações de Asad/ })).toBeNull();
});

test('o STAFF não abre o cadastro nem digitando o endereço', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/produtos/p1');

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

test('o recorte do endereço vira consulta filtrada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir(`/admin/produtos?status=inactive&categoria=${CATEGORY_ID}`);

  await screen.findByRole('link', { name: 'Asad' });

  expect(lastListCall()).toContain('status=inactive');
  expect(lastListCall()).toContain(`categoryId=${CATEGORY_ID}`);

  expect(screen.getByRole('button', { name: 'Fora do ar' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
});

test('o interruptor manda o valor oposto', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos');

  await user.click(await screen.findByRole('switch', { name: 'Publicar Asad' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.url).toContain('/admin/products/p1/status');
    // O produto estava publicado: o clique despublica.
    expect(write?.body).toContain('false');
  });
});

test('excluir pede confirmação nomeando o produto', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos');

  await user.click(await screen.findByRole('button', { name: 'Ações de Asad' }));
  await user.click(screen.getByRole('button', { name: /Excluir produto/ }));

  const dialog = await screen.findByRole('dialog');

  expect(dialog.textContent).toContain('Asad');
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Excluir o produto' }));

  await waitFor(() => {
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });
});

/* ---- O cadastro -------------------------------------------------------------- */

test('o cadastro novo abre com uma variante e sem nada preenchido', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos/novo');

  expect(await screen.findByRole('heading', { name: 'Novo produto' })).toBeDefined();

  // Produto sem variante nao existe: a tabela ja abre com a primeira linha.
  expect(screen.getByRole('textbox', { name: 'Nome da variante 1' })).toBeDefined();
});

test('salvar sem nome não chama o servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos/novo');

  await user.click(await screen.findByRole('button', { name: 'Cadastrar produto' }));

  expect(await screen.findByText(/Falta corrigir alguma coisa/)).toBeDefined();
  expect(lastWrite()).toBeUndefined();
});

test('cadastrar manda o preço em centavos', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos/novo');

  await user.type(await screen.findByRole('textbox', { name: 'Nome' }), 'Asad');
  await user.type(screen.getByRole('textbox', { name: 'Nome da variante 1' }), '100ml');
  await user.type(screen.getByRole('textbox', { name: 'Preço da variante 1' }), '189,90');

  await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('POST');
    // `189,90` e nao `18990.000000001`: a conversao passa por inteiro.
    expect(write?.body).toContain('"priceCents":18990');
  });
});

test('duplicar a variante copia o preço e limpa o SKU', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos/p1');

  const sku = await screen.findByRole('textbox', { name: 'SKU da variante 1' });

  expect((sku as HTMLInputElement).value).toBe('ASA-100');

  await user.click(screen.getByRole('button', { name: 'Duplicar a variante 1' }));

  const price2 = screen.getByRole('textbox', { name: 'Preço da variante 2' });
  const sku2 = screen.getByRole('textbox', { name: 'SKU da variante 2' });

  expect((price2 as HTMLInputElement).value).toBe('189,90');
  // O SKU e unico por variante: copia-lo faria a linha nova sobrescrever a
  // original ao salvar.
  expect((sku2 as HTMLInputElement).value).toBe('');
});

test('a edição manda PATCH e não muda o endereço do produto', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/produtos/p1');

  await user.type(await screen.findByRole('textbox', { name: 'Nome' }), ' Elixir');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.body).toContain('Asad Elixir');
    // O link ja foi para o WhatsApp de alguem: o endereco nao viaja no PATCH.
    expect(write?.body).not.toContain('"slug"');
  });
});
