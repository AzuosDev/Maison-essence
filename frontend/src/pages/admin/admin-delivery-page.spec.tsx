// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminDeliveryPage from './admin-delivery-page';

/**
 * A tela de entrega.
 *
 * O que estes casos cobram:
 *
 * - **gravar ao sair do campo**, e só o que mudou;
 * - **sair sem mudar nada não chama o servidor** — o gesto mais comum de quem
 *   confere a tabela;
 * - **a ordem que vai para o servidor**, que e a do checkout;
 * - **o STAFF não entra**: a tabela de taxas e preço.
 */

const CITIES = [
  {
    id: 'c1',
    name: 'Sobral',
    state: 'CE',
    feeCents: 1500,
    estimatedDays: 2,
    minOrderForFreeCents: null,
    isActive: true,
    order: 0,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Fortaleza',
    state: 'CE',
    feeCents: 3000,
    estimatedDays: 4,
    minOrderForFreeCents: 20_000,
    isActive: true,
    order: 1,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
];

let calls: { url: string; method: string; body: string }[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];

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

      if (method === 'GET') {
        return Promise.resolve(jsonResponse(CITIES));
      }

      if (url.includes('/reorder')) {
        return Promise.resolve(jsonResponse([CITIES[1], CITIES[0]]));
      }

      if (method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      // Devolve a cidade com o que foi mandado por cima: e o que o servidor
      // faria, e e disso que a tela tira o `savedId`.
      const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as object;

      return Promise.resolve(jsonResponse({ ...CITIES[0], ...patch }));
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

  const router = createMemoryRouter([{ path: '/admin/entrega', Component: AdminDeliveryPage }], {
    initialEntries: ['/admin/entrega'],
  });

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

/* ---- A planilha ------------------------------------------------------------- */

test('mostra as cidades com taxa, prazo e a frase do checkout', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  const fee = await screen.findByRole('textbox', { name: 'Taxa de Sobral' });

  expect((fee as HTMLInputElement).value).toBe('15,00');
  expect((screen.getByRole('textbox', { name: 'Prazo de Sobral' }) as HTMLInputElement).value).toBe(
    '2',
  );

  // A frase e a mesma que a cliente lê: `0` seria "No mesmo dia", e sem isso
  // escrito alguém o cadastra achando que e "sem prazo definido".
  expect(screen.getByText('Até 2 dias úteis')).toBeDefined();
  expect(screen.getByText('Até 4 dias úteis')).toBeDefined();
});

test('a cidade sem regra própria diz que segue a loja', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Taxa de Sobral' });

  expect(screen.getByText('segue a loja')).toBeDefined();
});

test('o STAFF não entra: a tabela de taxas e preço', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

/* ---- Gravar ao sair do campo -------------------------------------------------- */

test('mudar a taxa e sair do campo manda só a taxa', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const fee = await screen.findByRole('textbox', { name: 'Taxa de Sobral' });

  await user.clear(fee);
  await user.type(fee, '18,00');
  await user.tab();

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/delivery-cities/c1');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ feeCents: 1800 });
  });
});

test('sair do campo sem mudar nada não chama o servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const fee = await screen.findByRole('textbox', { name: 'Taxa de Sobral' });

  await user.click(fee);
  await user.tab();

  // E o gesto mais comum de quem esta conferindo a tabela: uma chamada por
  // campo percorrido encheria a rede sem gravar nada.
  expect(lastWrite()).toBeUndefined();
});

test('uma taxa inválida não viaja', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const fee = await screen.findByRole('textbox', { name: 'Taxa de Sobral' });

  await user.clear(fee);
  await user.tab();

  expect(lastWrite()).toBeUndefined();
  expect(await screen.findByText(/Escreva a taxa/)).toBeDefined();
});

test('apagar o frete grátis manda null, e não zero', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const free = await screen.findByRole('textbox', { name: 'Frete grátis de Fortaleza' });

  await user.clear(free);
  await user.tab();

  await waitFor(() => {
    // `null` devolve a cidade a regra global; zero daria frete grátis em
    // qualquer pedido.
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ minOrderForFreeCents: null });
  });
});

/* ---- A ordem do checkout -------------------------------------------------------- */

test('descer uma cidade manda a lista na ordem nova', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Sobral' }));
  await user.click(screen.getByRole('button', { name: 'Descer' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.url).toContain('/admin/delivery-cities/reorder');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ ids: ['c2', 'c1'] });
  });
});

/* ---- Cadastrar e excluir ---------------------------------------------------------- */

test('cadastrar uma cidade manda taxa em centavos e UF em maiúscula', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: /Adicionar cidade/ }));

  const dialog = await screen.findByRole('dialog');

  await user.type(within(dialog).getByRole('textbox', { name: 'Cidade' }), 'Crato');
  await user.type(within(dialog).getByRole('textbox', { name: 'UF' }), 'ce');
  await user.type(within(dialog).getByRole('textbox', { name: 'Taxa' }), '12,50');
  await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('POST');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({
      name: 'Crato',
      state: 'CE',
      feeCents: 1250,
      estimatedDays: 1,
      minOrderForFreeCents: null,
    });
  });
});

test('excluir explica que desativar guarda a taxa, e pede confirmação', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Sobral' }));
  await user.click(screen.getByRole('button', { name: 'Excluir' }));

  const dialog = await screen.findByRole('dialog');

  expect(dialog.textContent).toContain('Sobral/CE');
  expect(dialog.textContent).toContain('desligue o interruptor');
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Excluir a cidade' }));

  await waitFor(() => {
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });
});
