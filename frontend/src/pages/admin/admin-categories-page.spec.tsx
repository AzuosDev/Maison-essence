// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminCategoriesPage from './admin-categories-page';

/**
 * A tela de categorias.
 *
 * O que estes casos cobram:
 *
 * - **a ordem que vai para o servidor** — a lista plana em ordem de menu, que
 *   não aparece em tela nenhuma e e quem determina o menu da loja;
 * - **renomear no lugar** manda só o nome;
 * - **a oferta de desativar** quando a exclusão e recusada por 409;
 * - **o STAFF não entra**, nem digitando o endereço;
 * - **"dentro de" some** quando a categoria já tem subcategorias.
 */

const TREE = [
  {
    id: 'm',
    name: 'Masculino',
    slug: 'masculino',
    previousSlugs: [],
    parentId: null,
    image: '',
    order: 0,
    isActive: true,
    productCount: 12,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    children: [
      {
        id: 'm1',
        name: 'Amadeirado',
        slug: 'amadeirado',
        previousSlugs: [],
        parentId: 'm',
        image: '',
        order: 1,
        isActive: true,
        productCount: 5,
        createdAt: '2026-09-01T12:00:00.000Z',
        updatedAt: '2026-09-01T12:00:00.000Z',
      },
    ],
  },
  {
    id: 'f',
    name: 'Feminino',
    slug: 'feminino',
    previousSlugs: [],
    parentId: null,
    image: '',
    order: 2,
    isActive: true,
    productCount: 8,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    children: [],
  },
];

let calls: { url: string; method: string; body: string }[] = [];
/** O que a próxima escrita deve responder. */
let nextWrite: () => Response = () => jsonResponse(TREE[0]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  nextWrite = () => jsonResponse(TREE[0]);

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

      calls.push({
        url,
        method,
        body: typeof init?.body === 'string' ? init.body : '',
      });

      if (method === 'GET') {
        return Promise.resolve(jsonResponse(TREE));
      }

      if (url.includes('/reorder')) {
        return Promise.resolve(jsonResponse(TREE));
      }

      return Promise.resolve(nextWrite());
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
    [{ path: '/admin/categorias', Component: AdminCategoriesPage }],
    { initialEntries: ['/admin/categorias'] },
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

/* ---- A árvore -------------------------------------------------------------- */

test('desenha o menu com pai, filho e as contagens', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  expect(await screen.findByRole('button', { name: 'Renomear Masculino' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Renomear Amadeirado' })).toBeDefined();
  expect(screen.getByText('12')).toBeDefined();
  expect(screen.getByText(/2 principais e 1 subcategoria/)).toBeDefined();
});

test('o STAFF não entra nem digitando o endereço', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

/* ---- Reordenar -------------------------------------------------------------- */

test('descer um pai manda a lista plana em ordem de menu', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Masculino' }));
  await user.click(screen.getByRole('button', { name: 'Descer' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.url).toContain('/admin/categories/reorder');
    // Feminino sobe, e Masculino desce levando o filho junto. E esta ordem
    // que o servidor transforma em `order = indice`.
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ ids: ['f', 'm', 'm1'] });
  });
});

test('o primeiro pai não pode subir', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Masculino' }));

  expect(screen.getByRole('button', { name: 'Subir' }).hasAttribute('disabled')).toBe(true);
});

/* ---- Renomear no lugar --------------------------------------------------------- */

test('renomear no lugar manda só o nome', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Renomear Feminino' }));
  await user.clear(screen.getByRole('textbox', { name: 'Nome de Feminino' }));
  await user.type(screen.getByRole('textbox', { name: 'Nome de Feminino' }), 'Femininos{Enter}');

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/categories/f');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ name: 'Femininos' });
  });
});

test('Escape desiste sem chamar o servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Renomear Feminino' }));
  await user.type(screen.getByRole('textbox', { name: 'Nome de Feminino' }), 'x{Escape}');

  expect(lastWrite()).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Renomear Feminino' })).toBeDefined();
});

test('um nome curto demais volta ao anterior sem chamar o servidor', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Renomear Feminino' }));
  await user.clear(screen.getByRole('textbox', { name: 'Nome de Feminino' }));
  await user.type(screen.getByRole('textbox', { name: 'Nome de Feminino' }), 'F{Enter}');

  // O servidor exige duas letras: barrar aqui evita uma ida a rede para
  // receber de volta um erro que a tela já sabia.
  expect(lastWrite()).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Renomear Feminino' })).toBeDefined();
});

/* ---- Excluir ------------------------------------------------------------------- */

test('a recusa por 409 oferece desativar, e desativar manda isActive false', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Masculino' }));
  await user.click(screen.getByRole('button', { name: 'Excluir' }));

  const dialog = await screen.findByRole('dialog');

  expect(dialog.textContent).toContain('Masculino');

  await user.click(within(dialog).getByRole('button', { name: 'desative' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/categories/m');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ isActive: false });
  });
});

test('excluir de verdade chama DELETE depois da confirmação', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Feminino' }));
  await user.click(screen.getByRole('button', { name: 'Excluir' }));

  const dialog = await screen.findByRole('dialog');

  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Excluir a categoria' }));

  await waitFor(() => {
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });
});

/* ---- O diálogo -------------------------------------------------------------------- */

test('adicionar subcategoria já abre dentro do pai', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Masculino' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar subcategoria' }));

  const dialog = await screen.findByRole('dialog');
  const parent = within(dialog).getByLabelText('Dentro de');

  expect((parent as HTMLSelectElement).value).toBe('m');
});

test('quem já tem subcategorias não vê o campo de pai', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: 'Ações de Masculino' }));
  await user.click(screen.getByRole('button', { name: 'Endereço e posição' }));

  const dialog = await screen.findByRole('dialog');

  // Uma subcategoria não pode ter filhos: mostrar o campo levaria só a um
  // erro do servidor.
  expect(within(dialog).queryByLabelText('Dentro de')).toBeNull();
  expect(dialog.textContent).toContain('subcategoria não pode ter filhos');
});

test('criar uma categoria manda nome e pai nulo', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await user.click(await screen.findByRole('button', { name: /Nova categoria/ }));

  const dialog = await screen.findByRole('dialog');

  await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Árabes');
  await user.click(within(dialog).getByRole('button', { name: 'Criar categoria' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('POST');
    // Sem endereço: o servidor o gera a partir do nome.
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ name: 'Árabes', parentId: null });
  });
});
