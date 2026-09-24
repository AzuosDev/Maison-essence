// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminPaymentsPage from './admin-payments-page';

/**
 * A tela de pagamento.
 *
 * O que estes casos cobram:
 *
 * - **a previa e ao vivo e le o rascunho**, que e a razao de a tela existir
 *   desse jeito: a dona decide olhando a lista, antes de gravar;
 * - **a barra diz que o que se ve ainda nao vale**, porque a previa mudando
 *   na hora e facil de ler como "ja esta no ar";
 * - **so o que mudou viaja**, num documento unico que o celular da dona pode
 *   estar editando ao mesmo tempo;
 * - **a chave PIX e conferida contra o tipo antes de viajar**;
 * - **o STAFF nao entra**: aqui esta a chave para onde vai o dinheiro.
 */

const SETTINGS = {
  acceptsPix: true,
  pixKey: '12345678901',
  pixKeyType: 'cpf',
  pixDiscountPercent: 5,
  acceptsCard: true,
  maxInstallments: 12,
  interestFreeUpTo: 6,
  monthlyInterestPercent: 1.99,
  minInstallmentCents: 2000,
  updatedAt: '2026-09-01T12:00:00.000Z',
};

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
        return Promise.resolve(jsonResponse(SETTINGS));
      }

      // O servidor devolve o documento inteiro com o que foi mandado por
      // cima, ja normalizado. E disso que a tela reabre o rascunho.
      const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as object;

      return Promise.resolve(jsonResponse({ ...SETTINGS, ...patch }));
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

  const router = createMemoryRouter([{ path: '/admin/pagamento', Component: AdminPaymentsPage }], {
    initialEntries: ['/admin/pagamento'],
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

function previa() {
  return screen.getByRole('complementary', { name: 'Prévia do pagamento' });
}

/* ---- O que a tela mostra ------------------------------------------------------ */

test('abre com as regras gravadas, e a chave pontuada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  // Onze digitos corridos ninguem confere olhando, e conferir e a unica
  // coisa que se faz neste campo.
  expect((key as HTMLInputElement).value).toBe('123.456.789-01');
  expect((screen.getByRole('textbox', { name: 'Juros ao mês' }) as HTMLInputElement).value).toBe(
    '1,99',
  );
});

test('o STAFF não entra: aqui esta a chave para onde vai o dinheiro', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

/* ---- A previa ao vivo ---------------------------------------------------------- */

test('a prévia de R$ 300 separa o que tem juros do que não tem', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const painel = previa();

  // Ate 6x sem juros: 3x de R$ 100,00, e o total nao muda.
  expect(within(painel).getByText('de R$ 100,00')).toBeDefined();

  // 7x ja e tabela price, e o total sobe. Os mesmos centavos do backend.
  expect(within(painel).getByText('de R$ 46,33')).toBeDefined();
  expect(within(painel).getByText('R$ 324,35')).toBeDefined();
});

test('mexer no limite sem juros muda a lista antes de salvar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.selectOptions(screen.getByRole('combobox', { name: 'Sem juros até' }), '3');

  await waitFor(() => {
    // 4x saiu do grupo sem juros e virou financiado: R$ 300 em 4x a 1,99%.
    expect(within(previa()).queryByText('de R$ 75,00')).toBeNull();
  });

  // E nada viajou: a previa le o rascunho, nao o que esta gravado.
  expect(lastWrite()).toBeUndefined();
});

test('a prévia do PIX mostra o desconto sobre o valor cheio', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const painel = previa();

  expect(within(painel).getByText('R$ 285,00')).toBeDefined();
  expect(within(painel).getByText(/R\$ 15,00 de desconto/)).toBeDefined();
});

test('num pedido pequeno, a parcela mínima corta a lista e diz que cortou', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const amount = screen.getByRole('textbox', { name: 'Num pedido de' });

  await user.clear(amount);
  await user.type(amount, '90,00');

  // R$ 90 em 5x daria R$ 18, abaixo do minimo de R$ 20. A lista acaba em 4x,
  // e a unica pista disso e esta frase.
  expect(await within(previa()).findByText(/Acima de 4x a parcela fica abaixo de/)).toBeDefined();
  expect(within(previa()).queryByText('de R$ 18,00')).toBeNull();
});

/* ---- A barra de salvar ---------------------------------------------------------- */

test('sem mexer em nada não há barra de salvar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

test('a barra avisa que a prévia ainda não vale para quem esta comprando', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const juros = await screen.findByRole('textbox', { name: 'Juros ao mês' });

  await user.clear(juros);
  await user.type(juros, '2,49');

  expect(await screen.findByText(/continua vendo as regras antigas/)).toBeDefined();
});

test('salvar manda só o campo alterado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const juros = await screen.findByRole('textbox', { name: 'Juros ao mês' });

  await user.clear(juros);
  await user.type(juros, '2,49');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/payment-settings');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ monthlyInterestPercent: 2.49 });
  });
});

test('descartar devolve os campos ao que esta gravado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const juros = await screen.findByRole('textbox', { name: 'Juros ao mês' });

  await user.clear(juros);
  await user.type(juros, '9,90');
  await user.click(await screen.findByRole('button', { name: 'Descartar' }));

  expect((juros as HTMLInputElement).value).toBe('1,99');
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

/* ---- A chave PIX ----------------------------------------------------------------- */

test('a chave errada para o tipo escolhido não viaja', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);
  await user.type(key, 'loja@exemplo.com.br');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/deve ter 11 digitos/)).toBeDefined();
  expect(lastWrite()).toBeUndefined();
});

test('trocar só o tipo manda a chave junto, porque o servidor confere o par', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo da chave' }), 'random');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ pixKeyType: 'random', pixKey: '' });
  });
});

test('PIX ligado sem chave avisa, e mesmo assim deixa salvar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);

  // O servidor aceita. O que ele nao faz e avisar que o PIX parou de
  // aparecer para a cliente.
  expect(await screen.findByText(/sem chave cadastrada ele não aparece/)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDefined();
});

test('desligar as duas formas avisa que a loja ficou sem pagamento', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.click(screen.getByRole('switch', { name: 'Aceitar PIX' }));
  await user.click(screen.getByRole('switch', { name: 'Aceitar cartão' }));

  expect(await screen.findByText(/Nenhuma forma de pagamento esta ligada/)).toBeDefined();
});
