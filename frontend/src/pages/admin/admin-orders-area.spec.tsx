// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminOrderPage from './admin-order-page';
import AdminOrdersPage from './admin-orders-page';

/**
 * A area de pedidos do painel.
 *
 * O que estes casos cobram sao os criterios de aceite do prompt, e nao a
 * marcacao das telas:
 *
 * - **o STAFF nao ve preco**, nem na lista nem no detalhe;
 * - **o recorte mora no endereco**, e o card da abertura do painel consegue
 *   apontar para um filtro;
 * - **mudar o status reflete** — a chamada sai com o valor escolhido;
 * - **cancelar pede confirmacao nomeando o pedido**, e nao acontece por
 *   engano.
 *
 * A sessao e escrita direto no store, como nos outros casos do painel: o que
 * esta em teste e a tela, e nao a entrada.
 */

const SUMMARY = {
  id: 'o1',
  code: 'ME-260922-K4P1',
  status: 'PENDING_CONTACT',
  customerName: 'Rayane Alves',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  mode: 'delivery',
  payment: { method: 'card', installments: 3, hasInterest: false },
  itemCount: 2,
  totalCents: 37_980,
  createdAt: '2026-09-22T12:00:00.000Z',
};

const LIST = { items: [SUMMARY], page: 1, totalPages: 1, totalItems: 1, hasMore: false };

const ORDER = {
  id: 'o1',
  code: 'ME-260922-K4P1',
  status: 'PENDING_CONTACT',
  items: [
    {
      productId: 'p1',
      variantId: 'v1',
      productName: 'Asad',
      variantLabel: '100ml',
      image: '',
      unitPriceCents: 18_990,
      quantity: 2,
      discountPercent: 0,
      lineTotalCents: 37_980,
    },
  ],
  customer: {
    name: 'Rayane Alves',
    phone: '88999998888',
    phoneLabel: '(88) 99999-8888',
    email: '',
  },
  fulfillment: {
    mode: 'delivery',
    cityId: 'c1',
    cityName: 'Juazeiro do Norte',
    state: 'CE',
    estimatedDays: 2,
    address: {
      street: 'Rua das Flores',
      number: '120',
      complement: '',
      district: 'Centro',
      zipCode: '63010000',
      reference: 'Perto da praça',
    },
  },
  payment: { method: 'card', installments: 3, hasInterest: false },
  totals: {
    subtotalCents: 37_980,
    discountTotalCents: 0,
    deliveryFeeCents: 1000,
    pixDiscountCents: 0,
    totalCents: 38_980,
  },
  whatsappMessage: 'Pedido ME-260922-K4P1\nAsad 100ml x2',
  notes: '',
  stockRestoredAt: null,
  createdAt: '2026-09-22T12:00:00.000Z',
  updatedAt: '2026-09-22T12:00:00.000Z',
};

/** As chamadas que sairam, para os casos que perguntam o que foi pedido. */
let calls: { url: string; method: string; body: string }[] = [];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];

  // O jsdom nao tem `matchMedia`. Sem ele, a tabela se desenha como cards de
  // celular; a largura de desktop e a que tem colunas, e e nas colunas que a
  // ausencia do total significa alguma coisa.
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

      if (init?.method === 'PATCH') {
        const status = JSON.parse(typeof init.body === 'string' ? init.body : '{}') as {
          status?: string;
        };

        return Promise.resolve(jsonResponse({ ...ORDER, status: status.status ?? ORDER.status }));
      }

      if (/\/admin\/orders\/[^?]+$/.test(url)) {
        return Promise.resolve(jsonResponse(ORDER));
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

/**
 * Monta as duas telas sem a moldura do painel.
 *
 * O guarda de sessao e o menu ja tem os casos deles em `admin-home-page`.
 * Aqui interessa o conteudo, e a moldura so acrescentaria links com os
 * mesmos nomes dos que estes casos procuram.
 */
function abrir(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      { path: '/admin/pedidos', Component: AdminOrdersPage },
      { path: '/admin/pedidos/:id', Component: AdminOrderPage },
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

/** O ultimo `GET` da listagem. */
function lastListCall(): string {
  return calls.findLast((call) => call.method === 'GET')?.url ?? '';
}

/* ---- A lista ------------------------------------------------------------- */

test('a dona vê o total e a forma de pagamento na lista', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos');

  expect(await screen.findByRole('link', { name: 'ME-260922-K4P1' })).toBeDefined();
  expect(screen.getByText('R$ 379,80')).toBeDefined();
  expect(screen.getByText('Cartão 3x')).toBeDefined();
});

test('o STAFF não vê o total, mas vê como o cliente vai pagar', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/pedidos');

  expect(await screen.findByRole('link', { name: 'ME-260922-K4P1' })).toBeDefined();

  // O valor some: e a margem da loja.
  expect(screen.queryByText('R$ 379,80')).toBeNull();

  // A forma de pagamento fica: e o que ele precisa para atender.
  expect(screen.getByText('Cartão 3x')).toBeDefined();
});

test('o endereço com filtro vira consulta filtrada', async () => {
  signInAs(USER_ROLES.OWNER);

  // E o link do card "Esperando contato" da abertura do painel.
  abrir('/admin/pedidos?status=PENDING_CONTACT');

  await screen.findByRole('link', { name: 'ME-260922-K4P1' });

  expect(lastListCall()).toContain('status=PENDING_CONTACT');

  // E a pilula correspondente aparece escolhida, para que o recorte nao
  // fique invisivel na tela.
  expect(
    screen.getByRole('button', { name: 'Aguardando contato' }).getAttribute('aria-pressed'),
  ).toBe('true');
});

test('escolher um status refaz a consulta com ele', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos');

  await screen.findByRole('link', { name: 'ME-260922-K4P1' });

  await user.click(screen.getByRole('button', { name: 'Entregue' }));

  await waitFor(() => {
    expect(lastListCall()).toContain('status=DELIVERED');
  });
});

test('clicar no status que já esta valendo o desliga', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos?status=DELIVERED');

  await screen.findByRole('link', { name: 'ME-260922-K4P1' });

  await user.click(screen.getByRole('button', { name: 'Entregue' }));

  await waitFor(() => {
    expect(lastListCall()).not.toContain('status=');
  });
});

/* ---- O detalhe ------------------------------------------------------------ */

test('o detalhe mostra o pedido, o endereço e a mensagem enviada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos/o1');

  expect(await screen.findByRole('heading', { name: 'ME-260922-K4P1' })).toBeDefined();
  expect(screen.getByText('Asad')).toBeDefined();
  expect(screen.getByText(/Rua das Flores, 120/)).toBeDefined();
  expect(screen.getByText(/Asad 100ml x2/)).toBeDefined();

  // O total do pedido, e nao o subtotal: e o numero conferido contra o
  // comprovante.
  expect(screen.getByText('R$ 389,80')).toBeDefined();
});

test('o STAFF abre o pedido sem nenhum valor', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/pedidos/o1');

  expect(await screen.findByRole('heading', { name: 'ME-260922-K4P1' })).toBeDefined();

  // O item continua la, com a quantidade — e o que se confere ao separar.
  expect(screen.getByText('Asad')).toBeDefined();
  expect(screen.getByText('2 unidades')).toBeDefined();

  expect(screen.queryByText('R$ 389,80')).toBeNull();
  expect(screen.queryByText('R$ 379,80')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Valores' })).toBeNull();
});

test('o seletor de status não oferece o cancelamento', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos/o1');

  const select = await screen.findByLabelText('Situação do pedido');
  const values = Array.from(select.querySelectorAll('option'), (option) => option.value);

  expect(values).toContain('DELIVERED');
  expect(values).not.toContain('CANCELLED');
});

test('mover o status manda o novo valor para o servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos/o1');

  await user.selectOptions(await screen.findByLabelText('Situação do pedido'), 'CONFIRMED');

  await waitFor(() => {
    const patch = calls.find((call) => call.method === 'PATCH');

    expect(patch?.url).toContain('/admin/orders/o1/status');
    expect(patch?.body).toContain('CONFIRMED');
  });
});

test('cancelar pede confirmação nomeando o pedido antes de qualquer chamada', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir('/admin/pedidos/o1');

  await user.click(await screen.findByRole('button', { name: /Cancelar pedido/ }));

  // O codigo do pedido aparece no dialogo: e ele que se confere, e nao a
  // frase "tem certeza?", que ninguem le.
  const dialog = await screen.findByRole('dialog');

  expect(dialog.textContent).toContain('ME-260922-K4P1');

  // Nada saiu ainda.
  expect(calls.some((call) => call.method === 'PATCH')).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Cancelar o pedido' }));

  await waitFor(() => {
    const patch = calls.find((call) => call.method === 'PATCH');

    expect(patch?.body).toContain('CANCELLED');
  });
});

test('um pedido cancelado não oferece mais o seletor nem o botão', async () => {
  signInAs(USER_ROLES.OWNER);

  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          ...ORDER,
          status: 'CANCELLED',
          stockRestoredAt: '2026-09-23T10:00:00.000Z',
        }),
      ),
    ),
  );

  abrir('/admin/pedidos/o1');

  expect(await screen.findByText(/Pedido cancelado/)).toBeDefined();
  expect(screen.queryByLabelText('Situação do pedido')).toBeNull();
  expect(screen.queryByRole('button', { name: /Cancelar pedido/ })).toBeNull();
});
