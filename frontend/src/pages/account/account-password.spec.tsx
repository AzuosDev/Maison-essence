// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCustomerSession, type Customer } from '@/features/auth';
import AccountForgotPasswordPage from './account-forgot-password-page';
import AccountHomePage from './account-home-page';
import AccountNewPasswordPage from './account-new-password-page';

/**
 * Recuperar e trocar a senha da conta do cliente.
 *
 * O que estes casos cobram:
 *
 * - **pedir o link não conta se a conta existe**: a tela mostra a frase que o
 *   servidor devolve, que e a mesma nos dois casos, e troca o formulário por
 *   ela — clicar de novo e um e-mail a mais, e são três por hora;
 * - **o link quebrado diz o que fazer** antes de gastar uma viagem: cliente
 *   de e-mail que corta link longo e o caso real, e "peça outro" e a única
 *   saída;
 * - **trocar a senha pede a atual e a confirmação**, e a confirmação e desta
 *   tela, não do servidor: senha digitada errada uma vez só tranca a pessoa
 *   do lado de fora da própria conta;
 * - **trocar o e-mail pede a senha**, porque o e-mail passou a abrir a conta.
 */

const TOKEN = 'a'.repeat(64);

const CLIENTE: Customer = {
  id: 'c1',
  name: 'Felipe de Souza',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  email: 'felipe@exemplo.com',
  addresses: [],
  createdAt: '2026-01-10T12:00:00.000Z',
};

/** O que cada chamada recebeu, por rota. */
let enviado: Record<string, unknown>;

/** Rotas que devem recusar, com o status pedido. */
let recusa: Map<string, number>;

beforeEach(() => {
  enviado = {};
  recusa = new Map();

  useCustomerSession.getState().signOut();

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));

      for (const [rota, status] of recusa) {
        if (url.includes(rota)) {
          return Promise.resolve(jsonResponse({ message: 'recusado' }, status));
        }
      }

      if (url.includes('/customer/password/forgot')) {
        enviado.forgot = body;

        return Promise.resolve(
          jsonResponse({ message: 'Se existir uma conta com esse dado, o link acabou de sair.' }),
        );
      }

      if (url.includes('/customer/password/reset')) {
        enviado.reset = body;

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (url.includes('/customer/me/password')) {
        enviado.changePassword = body;

        return Promise.resolve(
          jsonResponse({
            accessToken: 'token-novo',
            refreshToken: 'refresh-novo',
            expiresIn: 900,
            tokenType: 'Bearer',
            customer: CLIENTE,
          }),
        );
      }

      if (url.includes('/customer/me')) {
        enviado.profile = body;

        return Promise.resolve(jsonResponse(CLIENTE));
      }

      return Promise.resolve(jsonResponse({}));
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * A tela, aberta no endereço dado.
 *
 * A rota e registrada sem a query, e a entrada vai com ela: o React Router
 * casa rota por caminho, e `/conta/senha/nova?token=...` registrado como rota
 * não casa com endereço nenhum. O token precisa viajar na entrada para a tela
 * o encontrar em `useSearchParams`, que e de onde ele vem de verdade.
 */
function abrir(entry: string, Component: () => JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const path = entry.split('?')[0] ?? entry;

  const router = createMemoryRouter(
    [
      { path, Component },
      { path: '/conta/entrar', element: <p>Entrar</p> },
      { path: '/conta/senha/esqueci', element: <p>Esqueci</p> },
    ],
    { initialEntries: [entry] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/* ---- Pedir o link ----------------------------------------------------------- */

test('o pedido sai com o que foi digitado, normalizado', async () => {
  const usuario = userEvent.setup();

  abrir('/conta/senha/esqueci', AccountForgotPasswordPage);

  await usuario.type(screen.getByLabelText('Celular ou e-mail'), '(88) 99999-8888');
  await usuario.click(screen.getByRole('button', { name: 'Enviar o link' }));

  await waitFor(() => {
    expect(enviado.forgot).toEqual({ identifier: '(88) 99999-8888' });
  });
});

test('depois de pedir, o formulário sai de cena e fica a frase do servidor', async () => {
  const usuario = userEvent.setup();

  abrir('/conta/senha/esqueci', AccountForgotPasswordPage);

  await usuario.type(screen.getByLabelText('Celular ou e-mail'), 'felipe@exemplo.com');
  await usuario.click(screen.getByRole('button', { name: 'Enviar o link' }));

  expect(await screen.findByText(/Se existir uma conta com esse dado/)).toBeTruthy();

  // Sem botão, não há como pedir de novo por engano — e cada pedido e um
  // e-mail, com três por hora.
  expect(screen.queryByRole('button', { name: 'Enviar o link' })).toBeNull();
});

test('o que não e celular nem e-mail não vira requisição', async () => {
  const usuario = userEvent.setup();

  abrir('/conta/senha/esqueci', AccountForgotPasswordPage);

  await usuario.type(screen.getByLabelText('Celular ou e-mail'), 'felipe');
  await usuario.click(screen.getByRole('button', { name: 'Enviar o link' }));

  expect(await screen.findByText(/Informe um celular com DDD/)).toBeTruthy();
  expect(enviado.forgot).toBeUndefined();
});

test('o 429 manda esperar, e não tentar de novo', async () => {
  const usuario = userEvent.setup();

  recusa.set('/customer/password/forgot', 429);
  abrir('/conta/senha/esqueci', AccountForgotPasswordPage);

  await usuario.type(screen.getByLabelText('Celular ou e-mail'), 'felipe@exemplo.com');
  await usuario.click(screen.getByRole('button', { name: 'Enviar o link' }));

  expect((await screen.findByRole('alert')).textContent).toMatch(/Espere um pouco/);
});

/* ---- Criar a senha nova ----------------------------------------------------- */

test('o link sem token diz que esta incompleto, antes de qualquer viagem', async () => {
  abrir('/conta/senha/nova', AccountNewPasswordPage);

  expect(
    await screen.findByRole('heading', { name: /Este link não esta completo/ }),
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Pedir outro link' })).toBeTruthy();
  expect(enviado.reset).toBeUndefined();
});

test('o token cortado pelo e-mail também', async () => {
  abrir(`/conta/senha/nova?token=${'a'.repeat(20)}`, AccountNewPasswordPage);

  expect(
    await screen.findByRole('heading', { name: /Este link não esta completo/ }),
  ).toBeTruthy();
  expect(enviado.reset).toBeUndefined();
});

test('a senha nova sai com o token da URL, e a tela manda entrar', async () => {
  const usuario = userEvent.setup();

  abrir(`/conta/senha/nova?token=${TOKEN}`, AccountNewPasswordPage);

  await usuario.type(screen.getByLabelText('Senha nova'), 'senha-nova-bem-longa');
  await usuario.type(screen.getByLabelText('Repita a senha'), 'senha-nova-bem-longa');
  await usuario.click(screen.getByRole('button', { name: 'Salvar a senha' }));

  await waitFor(() => {
    expect(enviado.reset).toEqual({ token: TOKEN, password: 'senha-nova-bem-longa' });
  });

  expect(await screen.findByRole('heading', { name: 'Senha criada' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy();

  // Nenhuma sessão foi aberta: quem chegou apresentou um link, não uma senha.
  expect(useCustomerSession.getState().status).not.toBe('authenticated');
});

test('duas senhas diferentes não chegam a sair do navegador', async () => {
  const usuario = userEvent.setup();

  abrir(`/conta/senha/nova?token=${TOKEN}`, AccountNewPasswordPage);

  await usuario.type(screen.getByLabelText('Senha nova'), 'senha-nova-bem-longa');
  await usuario.type(screen.getByLabelText('Repita a senha'), 'senha-nova-bem-longo');
  await usuario.click(screen.getByRole('button', { name: 'Salvar a senha' }));

  expect(await screen.findByText('As duas senhas precisam ser iguais.')).toBeTruthy();
  expect(enviado.reset).toBeUndefined();
});

test('o link vencido devolve a mensagem do servidor, com a saída ao lado', async () => {
  const usuario = userEvent.setup();

  recusa.set('/customer/password/reset', 400);
  abrir(`/conta/senha/nova?token=${TOKEN}`, AccountNewPasswordPage);

  await usuario.type(screen.getByLabelText('Senha nova'), 'senha-nova-bem-longa');
  await usuario.type(screen.getByLabelText('Repita a senha'), 'senha-nova-bem-longa');
  await usuario.click(screen.getByRole('button', { name: 'Salvar a senha' }));

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Pedir outro link' })).toBeTruthy();
});

/* ---- Trocar a senha estando dentro ------------------------------------------ */

function entrarNaConta(): void {
  useCustomerSession
    .getState()
    .signIn(CLIENTE, { accessToken: 'token', refreshToken: 'refresh' });
}

test('a troca manda a senha atual e a nova, e limpa os campos', async () => {
  const usuario = userEvent.setup();

  entrarNaConta();
  abrir('/conta', AccountHomePage);

  await usuario.type(await screen.findByLabelText('Senha atual'), 'senha-antiga-longa');
  await usuario.type(screen.getByLabelText('Senha nova'), 'senha-nova-bem-longa');
  await usuario.type(screen.getByLabelText('Repita a senha nova'), 'senha-nova-bem-longa');
  await usuario.click(screen.getByRole('button', { name: 'Trocar a senha' }));

  await waitFor(() => {
    expect(enviado.changePassword).toEqual({
      currentPassword: 'senha-antiga-longa',
      newPassword: 'senha-nova-bem-longa',
    });
  });

  // Senha digitada não fica esperando num formulário aberto.
  await waitFor(() => {
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('');
  });
});

test('a senha nova igual a atual não chega a sair', async () => {
  const usuario = userEvent.setup();

  entrarNaConta();
  abrir('/conta', AccountHomePage);

  await usuario.type(await screen.findByLabelText('Senha atual'), 'senha-antiga-longa');
  await usuario.type(screen.getByLabelText('Senha nova'), 'senha-antiga-longa');
  await usuario.type(screen.getByLabelText('Repita a senha nova'), 'senha-antiga-longa');
  await usuario.click(screen.getByRole('button', { name: 'Trocar a senha' }));

  expect(await screen.findByText('A nova senha precisa ser diferente da atual.')).toBeTruthy();
  expect(enviado.changePassword).toBeUndefined();
});

/* ---- O e-mail virou credencial ---------------------------------------------- */

test('o campo de senha só aparece quando o e-mail muda', async () => {
  const usuario = userEvent.setup();

  entrarNaConta();
  abrir('/conta', AccountHomePage);

  // Corrigir o nome não custa uma senha digitada.
  await usuario.type(await screen.findByLabelText('Nome'), ' Vasconcelos');
  expect(screen.queryByLabelText('Sua senha')).toBeNull();

  await usuario.clear(screen.getByLabelText('E-mail'));
  await usuario.type(screen.getByLabelText('E-mail'), 'outro@exemplo.com');

  expect(await screen.findByLabelText('Sua senha')).toBeTruthy();
});

test('trocar o e-mail manda a senha junto', async () => {
  const usuario = userEvent.setup();

  entrarNaConta();
  abrir('/conta', AccountHomePage);

  await usuario.clear(await screen.findByLabelText('E-mail'));
  await usuario.type(screen.getByLabelText('E-mail'), 'outro@exemplo.com');
  await usuario.type(await screen.findByLabelText('Sua senha'), 'senha-antiga-longa');
  await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

  await waitFor(() => {
    expect(enviado.profile).toMatchObject({
      email: 'outro@exemplo.com',
      currentPassword: 'senha-antiga-longa',
    });
  });
});

test('salvar só o nome não manda senha nenhuma', async () => {
  const usuario = userEvent.setup();

  entrarNaConta();
  abrir('/conta', AccountHomePage);

  await usuario.type(await screen.findByLabelText('Nome'), ' Vasconcelos');
  await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

  await waitFor(() => {
    expect(enviado.profile).toBeDefined();
  });

  expect(enviado.profile).not.toHaveProperty('currentPassword');
});
