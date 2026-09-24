// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCustomerSession } from '@/features/auth';
import AccountAddressesPage from './account-addresses-page';

/**
 * Os enderecos salvos, contra a API.
 *
 * O que so este arquivo prova — e que nenhum teste de unidade prova — e que
 * a tela **manda a lista inteira**. A API nao tem rota por endereco:
 * `PATCH /customer/me` recebe `addresses` e substitui o que esta gravado.
 * Uma tela que mandasse so o endereco alterado apagaria todos os outros, e o
 * sintoma apareceria em producao, uma vez, sem volta.
 *
 * As regras do padrao — exatamente um marcado, promocao ao excluir — moram
 * em `address-list.spec.ts`, onde sao baratas de cobrir. Aqui basta ver que
 * a lista certa sobe.
 */

const CASA = {
  id: 'a1',
  label: 'Casa',
  cityId: null,
  street: 'Rua das Flores',
  number: '120',
  complement: '',
  district: 'Centro',
  zipCode: '63010-000',
  reference: '',
  isDefault: true,
};

const TRABALHO = {
  ...CASA,
  id: 'a2',
  label: 'Trabalho',
  street: 'Avenida Leão Sampaio',
  number: '900',
  district: 'Lagoa Seca',
  isDefault: false,
};

const CLIENTE = {
  id: 'cli-1',
  name: 'Maria Silva',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  email: 'maria@exemplo.test',
  addresses: [CASA, TRABALHO],
  createdAt: '2026-09-22T12:00:00.000Z',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** O corpo do ultimo `PATCH /customer/me`. */
let gravado: { addresses?: { id?: string; label: string; isDefault: boolean }[] } | null = null;

beforeEach(() => {
  gravado = null;
  useCustomerSession.getState().signOut();

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/customer/me') && init?.method === 'PATCH') {
        gravado = JSON.parse(String(init.body)) as typeof gravado;

        return Promise.resolve(jsonResponse(CLIENTE));
      }

      if (url.includes('/customer/me')) {
        return Promise.resolve(jsonResponse(CLIENTE));
      }

      return Promise.resolve(jsonResponse([]));
    }),
  );
});

afterEach(() => {
  cleanup();
  useCustomerSession.getState().signOut();
  vi.unstubAllGlobals();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

function entrar(): void {
  useCustomerSession.getState().signIn(CLIENTE, { accessToken: 'token', refreshToken: 'refresh' });
}

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      { path: '/conta/enderecos', Component: AccountAddressesPage },
      { path: '/produtos', element: <p>Vitrine</p> },
      { path: '/conta/entrar', element: <p>Entrada</p> },
      { path: '/conta/criar', element: <p>Cadastro</p> },
    ],
    { initialEntries: ['/conta/enderecos'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

test('sem sessão, o convite — e não um redirecionamento', async () => {
  abrir();

  expect(await screen.findByText('Seus endereços salvos')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Voltar para a loja' })).toBeTruthy();
});

test('o apelido e o título, e o padrão aparece marcado', async () => {
  entrar();
  abrir();

  expect(await screen.findByRole('heading', { name: 'Casa' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Trabalho' })).toBeTruthy();
  expect(screen.getByText('Padrão')).toBeTruthy();

  // O endereco que ja e padrao nao oferece o botao de vira-lo padrao: um
  // botao que nao muda nada e uma promessa quebrada.
  expect(screen.queryByRole('button', { name: 'Usar Casa como endereço padrão' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Usar Trabalho como endereço padrão' })).toBeTruthy();
});

test('marcar outro como padrão manda a lista inteira, com um marcado só', async () => {
  const usuario = userEvent.setup();

  entrar();
  abrir();

  await screen.findByRole('heading', { name: 'Trabalho' });

  await usuario.click(screen.getByRole('button', { name: 'Usar Trabalho como endereço padrão' }));

  await waitFor(() => {
    expect(gravado).not.toBeNull();
  });

  // Os **dois** enderecos sobem. Mandar so o alterado apagaria o outro.
  expect(gravado?.addresses?.map((address) => address.id)).toEqual(['a1', 'a2']);
  expect(gravado?.addresses?.filter((address) => address.isDefault)).toHaveLength(1);
  expect(gravado?.addresses?.find((address) => address.isDefault)?.id).toBe('a2');
});

test('excluir confirma dentro do cartão, nomeando qual endereço vai sumir', async () => {
  const usuario = userEvent.setup();

  entrar();
  abrir();

  await screen.findByRole('heading', { name: 'Trabalho' });

  await usuario.click(screen.getByRole('button', { name: 'Excluir Trabalho' }));

  // Numa lista de cartoes parecidos, "tem certeza?" sem o nome nao diria de
  // qual deles se esta falando.
  expect(screen.getByText('Excluir Trabalho?')).toBeTruthy();

  // E o foco vai para "Manter": um Enter reflexo precisa desistir, nunca
  // apagar.
  expect(document.activeElement?.textContent).toContain('Manter');

  // `^Excluir$` e nao "Excluir": o botao do cartao se chama "Excluir
  // Trabalho", e so o da confirmacao leva a palavra sozinha.
  await usuario.click(screen.getByRole('button', { name: /^Excluir$/ }));

  await waitFor(() => {
    expect(gravado?.addresses?.map((address) => address.id)).toEqual(['a1']);
  });
});

test('o endereço novo entra na lista que já existe, sem apagar os outros', async () => {
  const usuario = userEvent.setup();

  entrar();
  abrir();

  await screen.findByRole('heading', { name: 'Casa' });

  await usuario.click(screen.getByRole('button', { name: /Novo endereço/ }));

  const dialogo = await screen.findByRole('dialog');

  await usuario.type(within(dialogo).getByLabelText('Apelido'), 'Casa da minha mãe');
  await usuario.type(within(dialogo).getByLabelText('Rua'), 'Rua São Pedro');
  await usuario.type(within(dialogo).getByLabelText('Bairro'), 'Salesianos');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar endereço' }));

  await waitFor(() => {
    expect(gravado?.addresses).toHaveLength(3);
  });

  expect(gravado?.addresses?.map((address) => address.label)).toEqual([
    'Casa',
    'Trabalho',
    'Casa da minha mãe',
  ]);

  // Sem marcar a caixa, o padrao continua sendo quem era.
  expect(gravado?.addresses?.find((address) => address.isDefault)?.label).toBe('Casa');
});
