// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AdminLayout } from '@/app/layouts';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import SystemLayout from './system-layout';
import SystemUsersPage from './system-users-page';

/**
 * A área de sistema, com papel de verdade.
 *
 * Os casos aqui cobram os três critérios de aceite:
 *
 * 1. A senha temporária aparece uma vez e não e recuperável depois.
 * 2. Desativar passa por uma confirmação que nomeia o alvo.
 * 3. O OWNER não vê o item Sistema nem entra na rota.
 *
 * A sessão e escrita direto no store, e não por um login simulado: o que
 * esta em teste e o recorte por papel e o comportamento da tela, não a tela
 * de entrada.
 */

const USERS = [
  {
    id: 'u1',
    name: 'Rayane Souza',
    email: 'rayane@maisonessence.test',
    role: 'SUPER_ADMIN',
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: '2026-09-22T11:00:00.000Z',
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-09-22T11:00:00.000Z',
  },
  {
    id: 'u2',
    name: 'Bianca Lima',
    email: 'bianca@maisonessence.test',
    role: 'STAFF',
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** O que a chamada de criação recebeu. E por ele que a senha e conferida. */
let created: { temporaryPassword?: string } | null = null;

beforeEach(() => {
  created = null;

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/users') && init?.method === 'POST') {
        created = JSON.parse(String(init.body)) as { temporaryPassword?: string };

        return Promise.resolve(
          jsonResponse({ ...USERS[1], id: 'u3', email: 'nova@maisonessence.test' }),
        );
      }

      if (url.includes('/users') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ ...USERS[1], isActive: false }));
      }

      if (url.includes('/users')) {
        return Promise.resolve(jsonResponse(USERS));
      }

      return Promise.resolve(jsonResponse([]));
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

function abrirSistema() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        Component: AdminLayout,
        children: [
          {
            path: 'system',
            Component: SystemLayout,
            children: [{ index: true, Component: SystemUsersPage }],
          },
        ],
      },
      { path: '/admin/entrar', element: <p>Tela de entrada</p> },
      { path: '/admin/trocar-senha', element: <p>Troque a senha</p> },
    ],
    { initialEntries: ['/admin/system'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/* ---- O recorte por papel -------------------------------------------------- */

test('o OWNER que digita a URL recebe a tela de acesso negado, e não um erro', async () => {
  signInAs(USER_ROLES.OWNER);

  abrirSistema();

  expect(await screen.findByText(/Esta área e do administrador do sistema/)).toBeDefined();

  // A tabela de usuários não chega a existir.
  expect(screen.queryByRole('table')).toBeNull();

  // E o caminho de volta esta na tela: ela não e um beco sem saída.
  expect(screen.getByRole('link', { name: /Voltar para o início/ })).toBeDefined();
});

test('o OWNER não vê Sistema nem Configurações na sidebar', () => {
  signInAs(USER_ROLES.OWNER);

  abrirSistema();

  const menu = screen.getByRole('navigation', { name: 'Áreas do painel' });

  expect(within(menu).queryByRole('link', { name: 'Sistema' })).toBeNull();
  expect(within(menu).queryByRole('link', { name: 'Configurações' })).toBeNull();

  // O que ele opera continua ali: o menu não encolheu por acidente.
  expect(within(menu).getByRole('link', { name: 'Pedidos' })).toBeDefined();
  expect(within(menu).getByRole('link', { name: 'Pagamento' })).toBeDefined();
});

test('o STAFF também não entra', async () => {
  signInAs(USER_ROLES.STAFF);

  abrirSistema();

  expect(await screen.findByText(/Esta área e do administrador do sistema/)).toBeDefined();
});

test('o administrador do sistema vê o item e a lista', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  const menu = screen.getByRole('navigation', { name: 'Áreas do painel' });

  expect(within(menu).getByRole('link', { name: 'Sistema' })).toBeDefined();
  expect(await screen.findByText('bianca@maisonessence.test')).toBeDefined();
});

/* ---- A lista -------------------------------------------------------------- */

test('quem nunca entrou aparece assim, e não com um traço', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  // Conta criada e nunca usada: a senha entregue talvez ainda esteja num
  // bilhete, e e isso que a coluna precisa dizer.
  expect(await screen.findByText('nunca entrou')).toBeDefined();
  expect(screen.getByText('Senha temporária')).toBeDefined();
});

test('a busca filtra por nome e por e-mail, sem ir ao servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  await screen.findByText('bianca@maisonessence.test');

  await user.type(screen.getByPlaceholderText('Buscar por nome ou e-mail'), 'bianca');

  expect(screen.queryByText('rayane@maisonessence.test')).toBeNull();
  expect(screen.getByText('bianca@maisonessence.test')).toBeDefined();
});

/* ---- A confirmação -------------------------------------------------------- */

test('desativar pede confirmação e mostra o e-mail do alvo', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  await screen.findByText('bianca@maisonessence.test');

  await user.click(screen.getByRole('button', { name: 'Ações de Bianca Lima' }));
  await user.click(screen.getByRole('button', { name: 'Desativar' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Desativar este acesso?')).toBeDefined();

  // O alvo, escrito: e o que separa desativar o acesso antigo de desativar
  // quem esta atendendo agora.
  expect(within(dialog).getByText('bianca@maisonessence.test')).toBeDefined();
});

test('a própria conta não oferece a opção de se desativar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  await screen.findByText('rayane@maisonessence.test');

  await user.click(screen.getByRole('button', { name: 'Ações de Rayane Souza' }));

  expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
  expect(screen.getByRole('button', { name: /Resetar senha/ })).toBeDefined();
});

/* ---- A senha temporária --------------------------------------------------- */

test('criar um acesso mostra a senha uma vez, e e a mesma que foi enviada', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  await screen.findByText('bianca@maisonessence.test');

  await user.click(screen.getByRole('button', { name: /Novo acesso/ }));

  await user.type(screen.getByLabelText('Nome'), 'Carla Dias');
  await user.type(screen.getByLabelText('E-mail'), 'nova@maisonessence.test');
  await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

  expect(await screen.findByText('Acesso criado')).toBeDefined();

  const shown = screen.getByLabelText(/Senha temporária de nova@maisonessence.test/);

  // A senha que a tela mostra e exatamente a que o servidor recebeu: se
  // fossem duas, a pessoa receberia uma senha que não entra.
  await waitFor(() => {
    expect(created?.temporaryPassword).toBeDefined();
  });

  expect(shown.textContent).toBe(created?.temporaryPassword);
  expect(shown.textContent).toHaveLength(16);

  // E o aviso de que ela não volta.
  expect(screen.getByText(/não aparece de novo/)).toBeDefined();
});

test('fechar o diálogo apaga a senha da tela para sempre', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrirSistema();

  await screen.findByText('bianca@maisonessence.test');

  await user.click(screen.getByRole('button', { name: /Novo acesso/ }));
  await user.type(screen.getByLabelText('Nome'), 'Carla Dias');
  await user.type(screen.getByLabelText('E-mail'), 'nova@maisonessence.test');
  await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

  await screen.findByText('Acesso criado');

  await user.click(screen.getByRole('button', { name: 'Fechar' }));

  // Não há "ver de novo": o servidor guarda só o hash, e a tela não guarda
  // nada. O único caminho para outra senha e resetar.
  expect(screen.queryByText('Acesso criado')).toBeNull();
  expect(screen.queryByText(String(created?.temporaryPassword))).toBeNull();
});
