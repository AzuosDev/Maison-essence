// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useAdminSession, useCustomerSession } from '@/features/auth';
import AccountLoginPage from './account-login-page';

/**
 * A porta unica.
 *
 * Esta area tem duas sessoes, dois logins no servidor e um formulario so. O
 * que estes casos protegem nao e o desenho: e a decisao de para onde cada
 * tentativa vai, que acontece **neste navegador**, a partir do formato do
 * que foi digitado. Um erro aqui manda a dona para o login de cliente e
 * devolve "celular ou senha nao conferem" a quem digitou o proprio e-mail.
 *
 * A tela e montada sem a moldura da conta de proposito: cabecalho, rodape e
 * consulta de configuracao nao participam de nenhuma destas decisoes, e
 * traze-los so daria a estes casos motivos de quebrar que nao sao deles.
 */

const CLIENTE = {
  id: 'cli-1',
  name: 'Maria Silva',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  email: 'maria@exemplo.test',
  addresses: [],
  createdAt: '2026-09-22T12:00:00.000Z',
};

const DONA = {
  id: 'u-1',
  name: 'Isabelle',
  email: 'dona@maisonessence.test',
  role: 'SUPER_ADMIN',
  isActive: true,
  mustChangePassword: false,
  credentialVersion: 1,
  lastLoginAt: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Por rota, o corpo da chamada que saiu. E por ele que os casos conferem. */
let enviado: Record<string, unknown> = {};

/** As duas rotas de login recusam quando isto tem o nome delas. */
let recusa = new Set<string>();

/** A dona chega com senha temporaria quando isto e verdade. */
let senhaTemporaria = false;

beforeEach(() => {
  enviado = {};
  recusa = new Set<string>();
  senhaTemporaria = false;

  useCustomerSession.getState().signOut();
  useAdminSession.getState().signOut();

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));

      if (url.includes('/customer/login')) {
        enviado.customerLogin = body;

        return recusa.has('customer')
          ? Promise.resolve(jsonResponse({ message: 'não confere' }, 401))
          : Promise.resolve(
              jsonResponse({
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresIn: 900,
                tokenType: 'Bearer',
                customer: CLIENTE,
              }),
            );
      }

      if (url.includes('/auth/login')) {
        enviado.staffLogin = body;

        return recusa.has('staff')
          ? Promise.resolve(jsonResponse({ message: 'não confere' }, 401))
          : Promise.resolve(
              jsonResponse({
                accessToken: 'token',
                refreshToken: 'refresh',
                expiresIn: 900,
                tokenType: 'Bearer',
                user: { ...DONA, mustChangePassword: senhaTemporaria },
              }),
            );
      }

      return Promise.resolve(jsonResponse({}));
    }),
  );
});

afterEach(() => {
  cleanup();
  useCustomerSession.getState().signOut();
  useAdminSession.getState().signOut();
  vi.unstubAllGlobals();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

/**
 * A tela, com os destinos possiveis em cena.
 *
 * As quatro rotas de chegada existem para que o caso confira **o endereco**
 * e nao uma chamada de `navigate`: e o endereco que diz se a pessoa entrou
 * no lugar certo.
 */
function abrirEntrada(state?: { from: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      { path: '/conta/entrar', Component: AccountLoginPage },
      { path: '/conta/pedidos', element: <p>Meus pedidos</p> },
      { path: '/conta/pedidos/:code', element: <p>Um pedido</p> },
      { path: '/admin', element: <p>Painel</p> },
      { path: '/admin/pedidos', element: <p>Pedidos do painel</p> },
      { path: '/admin/trocar-senha', element: <p>Trocar a senha</p> },
      { path: '/produtos', element: <p>Vitrine</p> },
    ],
    { initialEntries: [{ pathname: '/conta/entrar', state }] },
  );

  return {
    router,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

function campo(nome: string): HTMLElement {
  return screen.getByLabelText(nome);
}

async function entrar(usuario: ReturnType<typeof userEvent.setup>, quem: string, senha: string) {
  await usuario.type(campo('Celular ou e-mail'), quem);
  await usuario.type(campo('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

/* ---- Cada um para o seu login ---------------------------------------------- */

test('o celular vai para o login do cliente, normalizado', async () => {
  const usuario = userEvent.setup();
  const { router } = abrirEntrada();

  await entrar(usuario, '(88) 99999-8888', 'segredo12345');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/conta/pedidos');
  });

  expect(enviado.customerLogin).toEqual({ phone: '88999998888', password: 'segredo12345' });
  expect(enviado.staffLogin).toBeUndefined();
});

test('o e-mail vai para o login do painel, e a sessão aberta e a do painel', async () => {
  const usuario = userEvent.setup();
  const { router } = abrirEntrada();

  await entrar(usuario, 'Dona@MaisonEssence.test', 'senhadaloja123');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/admin');
  });

  // Em minusculas: e a mesma chave que o limite de tentativas do servidor
  // usa, e "Dona@..." nao pode contar como outra combinacao.
  expect(enviado.staffLogin).toEqual({
    email: 'dona@maisonessence.test',
    password: 'senhadaloja123',
  });
  expect(enviado.customerLogin).toBeUndefined();

  expect(useAdminSession.getState().status).toBe('authenticated');
  expect(useCustomerSession.getState().status).not.toBe('authenticated');
});

/**
 * A senha temporaria vence o destino.
 *
 * Com ela, o backend recusa toda rota administrativa menos a da troca:
 * mandar a pessoa para o painel mostraria erro em cada tela que ela abrisse.
 */
test('a senha temporária leva direto para a troca, e não para o painel', async () => {
  senhaTemporaria = true;

  const usuario = userEvent.setup();
  const { router } = abrirEntrada({ from: '/admin/pedidos' });

  await entrar(usuario, 'dona@maisonessence.test', 'temporaria123');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/admin/trocar-senha');
  });
});

test('quem foi barrado no painel volta para a tela que o barrou', async () => {
  const usuario = userEvent.setup();
  const { router } = abrirEntrada({ from: '/admin/pedidos' });

  await entrar(usuario, 'dona@maisonessence.test', 'senhadaloja123');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/admin/pedidos');
  });
});

test('o cliente volta para a tela que o trouxe até aqui', async () => {
  const usuario = userEvent.setup();
  const { router } = abrirEntrada({ from: '/conta/pedidos/ME-260901-AB12' });

  await entrar(usuario, '88999998888', 'segredo12345');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/conta/pedidos/ME-260901-AB12');
  });
});

/**
 * O la e ca sem fim, que o filtro de `from` existe para impedir.
 *
 * Um cliente esbarra no painel, o guarda de la o manda para esta tela com
 * `from: '/admin'`, e ele entra com o proprio celular. Mandado para
 * `/admin`, o guarda o devolveria para ca; a sessao dele, valida, o mandaria
 * de novo para `/admin`. O destino do cliente nunca e o painel.
 */
test('o cliente que veio do painel não e devolvido ao painel', async () => {
  const usuario = userEvent.setup();
  const { router } = abrirEntrada({ from: '/admin/pedidos' });

  await entrar(usuario, '88999998888', 'segredo12345');

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/conta/pedidos');
  });
});

/* ---- A recusa -------------------------------------------------------------- */

/**
 * O conselho sobre o DDD sai de quem digitou, nao de quem respondeu.
 *
 * O `401` e o mesmo nos dois logins, de proposito. O que a tela adapta e a
 * frase, a partir do formato do que esta no campo — uma leitura local, que
 * nao conta nada a quem nao digitou aquilo.
 */
test('errar o e-mail não rende conselho sobre DDD', async () => {
  recusa.add('staff');

  const usuario = userEvent.setup();

  abrirEntrada();
  await entrar(usuario, 'dona@maisonessence.test', 'errada');

  const aviso = await screen.findByRole('alert');

  expect(aviso.textContent).toBe('E-mail ou senha não conferem.');
});

test('errar o celular rende o conselho sobre DDD', async () => {
  recusa.add('customer');

  const usuario = userEvent.setup();

  abrirEntrada();
  await entrar(usuario, '88999998888', 'errada');

  const aviso = await screen.findByRole('alert');

  expect(aviso.textContent).toContain('Confira o número com o DDD');
});

/**
 * A recusa anterior sai de cena antes da tentativa seguinte.
 *
 * Sao dois logins com dois estados de erro, e sem limpar um deles a tela
 * mostraria a mensagem do canal errado. O caso duro nao e a frase: e o
 * `429` de um canal sobrevivendo ao `401` do outro, mandando esperar quem
 * so precisava conferir a senha.
 */
test('errar no celular e depois no e-mail mostra a recusa do e-mail', async () => {
  recusa.add('customer');
  recusa.add('staff');

  const usuario = userEvent.setup();

  abrirEntrada();
  await entrar(usuario, '88999998888', 'errada');

  expect((await screen.findByRole('alert')).textContent).toContain('Confira o número com o DDD');

  await usuario.clear(campo('Celular ou e-mail'));
  await entrar(usuario, 'dona@maisonessence.test', 'errada');

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toBe('E-mail ou senha não conferem.');
  });
});

/* ---- O campo --------------------------------------------------------------- */

/**
 * O placeholder nao pode desmentir o rotulo.
 *
 * Havia `(88) 99999-9999` ali, herdado do campo de telefone. Um exemplo
 * preenchido pesa mais que o nome do campo: com ele, a tela pedia um numero
 * mesmo escrito "celular ou e-mail" logo acima, e quem ia entrar com e-mail
 * parava para perguntar.
 */
test('o campo não anuncia só um dos dois formatos', () => {
  abrirEntrada();

  const anuncio = campo('Celular ou e-mail').getAttribute('placeholder') ?? '';

  expect(anuncio).toMatch(/celular/i);
  expect(anuncio).toMatch(/e-mail/i);

  // Um telefone de exemplo e justamente o que dizia "so numero aqui".
  expect(anuncio).not.toMatch(/\d/);
});

/**
 * Nada sai deste navegador enquanto o que foi digitado nao for nem uma coisa
 * nem outra. Mandar para o servidor adivinhar so gastaria uma das tentativas
 * que o limite conta.
 */
test('o que não e celular nem e-mail não chega a virar requisição', async () => {
  const usuario = userEvent.setup();

  abrirEntrada();
  await entrar(usuario, 'maria', 'segredo12345');

  expect(await screen.findByText(/Informe um celular com DDD/)).toBeTruthy();
  expect(enviado.customerLogin).toBeUndefined();
  expect(enviado.staffLogin).toBeUndefined();
});

/**
 * O campo e um so, e a mascara nao pode atrapalhar quem vai escrever letras.
 * O caso duro e o e-mail que comeca com numeros: ate a arroba, ele e
 * indistinguivel de um telefone.
 */
test('o e-mail que começa com números não sai com parenteses dentro', async () => {
  const usuario = userEvent.setup();

  abrirEntrada();
  await entrar(usuario, '123456@maisonessence.test', 'senhadaloja123');

  await waitFor(() => {
    expect(enviado.staffLogin).toEqual({
      email: '123456@maisonessence.test',
      password: 'senhadaloja123',
    });
  });
});

/** Quem digitou um numero e nao tem conta leva o numero para o cadastro. */
test('o celular digitado atravessa para o cadastro', async () => {
  const usuario = userEvent.setup();

  abrirEntrada();
  await usuario.type(campo('Celular ou e-mail'), '88999998888');

  const link = screen.getByRole('link', { name: 'Criar a minha' });

  expect(link.getAttribute('href')).toBe('/conta/criar?telefone=88999998888');
});

/** Um e-mail, nao: o cadastro do cliente e pelo telefone. */
test('o e-mail digitado não atravessa para o cadastro', async () => {
  const usuario = userEvent.setup();

  abrirEntrada();
  await usuario.type(campo('Celular ou e-mail'), 'dona@maisonessence.test');

  expect(screen.getByRole('link', { name: 'Criar a minha' }).getAttribute('href')).toBe(
    '/conta/criar',
  );
});
