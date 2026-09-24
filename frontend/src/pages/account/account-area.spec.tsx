// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AccountLayout } from '@/app/layouts';
import { ToastProvider } from '@/components/ui';
import { useCustomerSession } from '@/features/auth';
import { useCart } from '@/features/cart';
import AccountLoginPage from './account-login-page';
import AccountOrderPage from './account-order-page';
import AccountOrdersPage from './account-orders-page';
import AccountRegisterPage from './account-register-page';

/**
 * A area do cliente contra a API.
 *
 * Os tres criterios de aceite, escritos como codigo, mais o que o enunciado
 * chama de sete e e a decisao estrutural desta area:
 *
 * 1. **Criar conta com o telefone de um pedido de convidado traz aquele
 *    pedido.** A metade que cabe ao frontend e mandar para cima **o mesmo
 *    numero** — a adocao e do servidor, e ela procura por telefone. Um
 *    digito diferente aqui, ou o `55` na frente, e um historico que nunca
 *    aparece.
 * 2. **Pedir novamente monta o carrinho e ignora os itens inativos.**
 *    Conferido no que foi parar na sacola, e nao no que a tela desenhou.
 * 3. **O checkout continua funcionando sem login.** Nao ha caso aqui, e a
 *    ausencia e a prova: `checkout-page.spec.tsx` roda inteiro sem nunca
 *    chamar `signIn`, e nada nesta entrega tocou o checkout. Um caso novo
 *    aqui so duplicaria aquele arquivo.
 * 4. **Nenhum ponto da loja tem parede de login.** O convite aparece **no
 *    endereco que a pessoa digitou**, e nao depois de um redirecionamento —
 *    e sempre com a saida para a loja a vista.
 */

const CONFIG = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: '',
  contactEmail: '',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: true,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

/** O pedido que a cliente fez como convidada, com o telefone dela. */
const PEDIDO_DE_CONVIDADO = {
  id: 'o1',
  code: 'ME-260901-AB12',
  status: 'DELIVERED',
  customerName: 'Maria Silva',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  mode: 'delivery',
  itemCount: 2,
  totalCents: 39480,
  createdAt: '2026-09-01T12:00:00.000Z',
};

const DETALHE = {
  ...PEDIDO_DE_CONVIDADO,
  status: 'DELIVERED',
  items: [
    {
      productId: 'p1',
      variantId: 'v1',
      productName: 'Asad Lattafa',
      variantLabel: '100ml',
      image: '',
      unitPriceCents: 18990,
      quantity: 1,
      discountPercent: 0,
      lineTotalCents: 18990,
    },
    {
      productId: 'p2',
      variantId: 'v2',
      productName: 'Khamrah Qahwa',
      variantLabel: '',
      image: '',
      unitPriceCents: 18990,
      quantity: 1,
      discountPercent: 0,
      lineTotalCents: 18990,
    },
  ],
  customer: {
    name: 'Maria Silva',
    phone: '88999998888',
    phoneLabel: '(88) 99999-8888',
    email: 'maria@exemplo.test',
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
      zipCode: '63010-000',
      reference: '',
    },
  },
  payment: { method: 'pix', installments: 1, hasInterest: false },
  totals: {
    subtotalCents: 37980,
    discountTotalCents: 0,
    deliveryFeeCents: 1500,
    pixDiscountCents: 0,
    totalCents: 39480,
  },
  whatsappMessage: 'Pedido ME-260901-AB12',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-10T18:00:00.000Z',
};

/**
 * A cotacao do "pedir novamente": o primeiro item vale, o segundo saiu.
 *
 * E o caso do criterio de aceite — a sacola tem de receber um item so, e a
 * tela tem de dizer qual ficou de fora.
 */
const COTACAO = {
  items: [
    {
      productId: 'p1',
      variantId: 'v1',
      productName: 'Asad Lattafa',
      productSlug: 'asad-lattafa',
      variantLabel: '100ml',
      image: 'maison/asad',
      quantity: 1,
      unitPriceCents: 19990,
      availableStock: 5,
      allowBackorder: false,
      discountPercent: 0,
      discountCents: 0,
      lineTotalCents: 19990,
      unavailable: false,
      unavailableReason: '',
    },
    {
      productId: 'p2',
      variantId: 'v2',
      productName: 'Khamrah Qahwa',
      productSlug: 'khamrah-qahwa',
      variantLabel: '',
      image: '',
      quantity: 1,
      unitPriceCents: 0,
      availableStock: 0,
      allowBackorder: false,
      discountPercent: 0,
      discountCents: 0,
      lineTotalCents: 0,
      unavailable: true,
      unavailableReason: 'Este produto saiu do catalogo.',
    },
  ],
  fulfillment: {
    mode: 'pickup',
    cityId: null,
    cityName: '',
    state: '',
    estimatedDays: 0,
    requiresAddress: false,
    feeCents: 0,
    isFree: true,
    freeReason: '',
    missingForFreeCents: null,
  },
  payment: { method: 'pix', installments: 1, selected: null },
  subtotalCents: 19990,
  discountTotalCents: 0,
  deliveryFeeCents: 0,
  pixDiscountCents: 0,
  totalCents: 19990,
  installmentOptions: [],
  warnings: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** O corpo de cada chamada que saiu, por rota. E por ele que os casos conferem. */
let enviado: Record<string, unknown> = {};

/** O que a lista da conta devolve. O caso do cadastro comeca com ela vazia. */
let pedidosDaConta: unknown[] = [];

beforeEach(() => {
  enviado = {};
  pedidosDaConta = [PEDIDO_DE_CONVIDADO];

  useCart.getState().clear();
  useCustomerSession.getState().signOut();

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));

      if (url.includes('/customer/register')) {
        enviado.register = body;

        // O servidor adota os pedidos daquele telefone no momento do
        // cadastro. Daqui em diante a lista da conta os traz.
        pedidosDaConta = [PEDIDO_DE_CONVIDADO];

        return Promise.resolve(
          jsonResponse({
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresIn: 900,
            tokenType: 'Bearer',
            customer: CLIENTE,
          }),
        );
      }

      if (url.includes('/customer/login')) {
        enviado.login = body;
        pedidosDaConta = [PEDIDO_DE_CONVIDADO];

        return Promise.resolve(
          jsonResponse({
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresIn: 900,
            tokenType: 'Bearer',
            customer: CLIENTE,
          }),
        );
      }

      if (url.includes('/customer/orders/')) {
        return Promise.resolve(jsonResponse(DETALHE));
      }

      if (url.includes('/customer/orders')) {
        return Promise.resolve(
          jsonResponse({
            items: pedidosDaConta,
            page: 1,
            limit: 10,
            totalItems: pedidosDaConta.length,
            totalPages: 1,
          }),
        );
      }

      if (url.includes('/customer/me')) {
        return Promise.resolve(jsonResponse(CLIENTE));
      }

      if (url.includes('/cart/quote')) {
        enviado.quote = body;

        return Promise.resolve(jsonResponse(COTACAO));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIG));
      }

      if (url.includes('/pages') || url.includes('/categories')) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse({ items: [], page: 1, totalPages: 1, totalItems: 0 }));
    }),
  );
});

const CLIENTE = {
  id: 'cli-1',
  name: 'Maria Silva',
  phone: '88999998888',
  phoneLabel: '(88) 99999-8888',
  email: 'maria@exemplo.test',
  addresses: [],
  createdAt: '2026-09-22T12:00:00.000Z',
};

afterEach(() => {
  cleanup();
  useCustomerSession.getState().signOut();
  useCart.getState().clear();
  vi.unstubAllGlobals();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

function entrarComoCliente(): void {
  useCustomerSession.getState().signIn(CLIENTE, { accessToken: 'token', refreshToken: 'refresh' });
}

/**
 * A area monta num roteador de dados.
 *
 * O layout da conta traz o `<ScrollRestoration>`, que exige um roteador
 * criado por `createMemoryRouter` — o mesmo motivo do teste da moldura da
 * loja.
 */
/**
 * Um campo do formulario que esta em cena.
 *
 * Escopado ao `<form>`, e nao a tela inteira: a moldura da loja vem junto
 * nestes casos, e o rodape tambem tem um "E-mail". Buscar na tela toda
 * acharia os dois e o caso quebraria por um motivo que nao e o dele.
 */
function campo(nome: string): HTMLElement {
  const form = document.querySelector('form');

  if (form === null) {
    throw new Error('nenhum formulario em cena');
  }

  return within(form).getByLabelText(nome);
}

function abrirConta(endereco: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        path: '/conta',
        Component: AccountLayout,
        children: [
          { path: 'entrar', Component: AccountLoginPage },
          { path: 'criar', Component: AccountRegisterPage },
          { path: 'pedidos', Component: AccountOrdersPage },
          { path: 'pedidos/:code', Component: AccountOrderPage },
        ],
      },
      { path: '/produtos', element: <p>Vitrine</p> },
    ],
    { initialEntries: [endereco] },
  );

  return {
    router,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
}

/* ---- Criterio 4: a conta e convite, nunca parede ---------------------------- */

test('sem sessao, os pedidos mostram o convite no mesmo endereco', async () => {
  const { router } = abrirConta('/conta/pedidos');

  expect(await screen.findByText('Seus pedidos ficam guardados aqui')).toBeTruthy();

  // A prova de que nao houve parede: o endereco continua sendo o que a
  // pessoa digitou. Um `<Navigate to="/conta/entrar">` teria trocado por
  // outro, e o "voltar" do navegador a jogaria de volta aqui para sempre.
  expect(router.state.location.pathname).toBe('/conta/pedidos');
});

test('o convite mostra a saida para a loja, e nao so as duas portas', () => {
  abrirConta('/conta/pedidos');

  const convite = screen.getByRole('region', { name: 'Seus pedidos ficam guardados aqui' });

  expect(within(convite).getByRole('link', { name: 'Entrar' })).toBeTruthy();
  expect(within(convite).getByRole('link', { name: 'Criar minha conta' })).toBeTruthy();

  // A linha que separa um convite de uma parede.
  expect(within(convite).getByText(/Comprar nao exige conta nenhuma/)).toBeTruthy();
  expect(within(convite).getByRole('link', { name: 'Voltar para a loja' })).toBeTruthy();
});

test('sem sessao nao ha menu da conta: tres links que nao levam a lugar nenhum', () => {
  abrirConta('/conta/pedidos');

  expect(screen.queryByRole('navigation', { name: 'Areas da conta' })).toBeNull();
});

test('com sessao, o menu aparece e a saudacao traz o telefone da conta', async () => {
  entrarComoCliente();
  abrirConta('/conta/pedidos');

  const menu = screen.getByRole('navigation', { name: 'Areas da conta' });

  expect(within(menu).getByRole('link', { name: 'Meus pedidos' })).toBeTruthy();

  // O telefone e a identidade da conta, e esta escrito onde se ve de
  // relance: e o que explica por que um pedido antigo esta ou nao na lista.
  expect(screen.getByText(/\(88\) 99999-8888/)).toBeTruthy();
  expect(await screen.findByText('ME-260901-AB12')).toBeTruthy();
});

/* ---- Criterio 1: o pedido de convidado entra na conta ----------------------- */

test('criar conta com o telefone do pedido traz aquele pedido para a lista', async () => {
  const usuario = userEvent.setup();

  // A conta ainda nao existe: o pedido esta solto, ligado so ao telefone.
  pedidosDaConta = [];

  // A confirmacao do pedido manda o telefone do convidado na URL. E por ele
  // que o servidor liga as compras anteriores a conta nova.
  abrirConta('/conta/criar?telefone=88999998888');

  // O campo ja chega preenchido e formatado: pedir o numero de novo criaria
  // a chance de ele ser digitado diferente.
  expect(campo('Celular')).toHaveProperty('value', '(88) 99999-8888');

  await usuario.type(campo('Nome'), 'Maria Silva');
  await usuario.type(campo('E-mail'), 'maria@exemplo.test');
  await usuario.type(campo('Senha'), 'segredo12345');
  await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

  // A metade que cabe ao frontend: subiu **o mesmo numero**, em onze digitos
  // e sem o codigo do pais — que e como o pedido o guardou.
  await waitFor(() => {
    expect(enviado.register).toMatchObject({ phone: '88999998888' });
  });

  // E a metade que aparece para quem cadastrou: o pedido feito como
  // convidada ja esta na lista.
  expect(await screen.findByText('ME-260901-AB12')).toBeTruthy();
  expect(screen.getByText('Entregue')).toBeTruthy();
});

test('o telefone digitado com o codigo do pais sobe normalizado', async () => {
  const usuario = userEvent.setup();

  // Quem cola de um contato salvo quase sempre traz o `55` junto. Se ele
  // subisse, a conta nasceria com um numero que nenhum pedido tem.
  abrirConta('/conta/criar?telefone=5588999998888');

  await usuario.type(campo('Nome'), 'Maria Silva');
  await usuario.type(campo('E-mail'), 'maria@exemplo.test');
  await usuario.type(campo('Senha'), 'segredo12345');
  await usuario.click(screen.getByRole('button', { name: 'Criar conta' }));

  await waitFor(() => {
    expect(enviado.register).toMatchObject({ phone: '88999998888' });
  });
});

test('entrar volta para a tela que trouxe a pessoa ate aqui', async () => {
  const usuario = userEvent.setup();

  const { router } = abrirConta('/conta/pedidos');

  await usuario.click(screen.getByRole('link', { name: 'Entrar' }));

  await usuario.type(campo('Celular ou e-mail'), '88999998888');
  await usuario.type(campo('Senha'), 'segredo12345');
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/conta/pedidos');
  });

  expect(await screen.findByText('ME-260901-AB12')).toBeTruthy();
});

/* ---- Criterio 2: pedir novamente ------------------------------------------- */

test('pedir novamente monta o carrinho e deixa de fora o item que saiu do catalogo', async () => {
  const usuario = userEvent.setup();

  entrarComoCliente();
  abrirConta('/conta/pedidos/ME-260901-AB12');

  await screen.findByRole('heading', { name: 'ME-260901-AB12' });

  await usuario.click(screen.getByRole('button', { name: /Pedir novamente/ }));

  // O que foi perguntado ao servidor: as duas linhas do pedido, sem preco.
  await waitFor(() => {
    expect(enviado.quote).toMatchObject({
      items: [
        { productId: 'p1', variantId: 'v1', quantity: 1 },
        { productId: 'p2', variantId: 'v2', quantity: 1 },
      ],
    });
  });

  // O que foi parar na sacola: so o que a cotacao disse que ainda vale.
  await waitFor(() => {
    expect(useCart.getState().lines).toEqual([{ productId: 'p1', variantId: 'v1', quantity: 1 }]);
  });

  // E a tela diz qual ficou de fora, e por que — na pagina, e nao num aviso
  // que some em cinco segundos.
  const aviso = await screen.findByRole('region', {
    name: 'O catalogo mudou desde este pedido',
  });

  expect(within(aviso).getByText('Khamrah Qahwa')).toBeTruthy();
  expect(within(aviso).getByText(/saiu do catalogo/)).toBeTruthy();
});

/* ---- O detalhe --------------------------------------------------------------- */

test('o detalhe mostra itens, valores, endereco e pagamento', async () => {
  entrarComoCliente();
  abrirConta('/conta/pedidos/ME-260901-AB12');

  await screen.findByRole('heading', { name: 'ME-260901-AB12' });

  expect(screen.getByText('Asad Lattafa')).toBeTruthy();
  expect(screen.getByText('Rua das Flores, 120')).toBeTruthy();
  expect(screen.getByText('PIX')).toBeTruthy();

  // Os valores sao os que o servidor congelou, e nenhum e recalculado aqui:
  // o subtotal, a taxa de entrega e o total sao tres numeros do pedido.
  expect(screen.getByText('R$ 379,80')).toBeTruthy();
  expect(screen.getByText('R$ 15,00')).toBeTruthy();
  expect(screen.getByText('R$ 394,80')).toBeTruthy();
});

test('a trilha mostra as datas que o pedido guarda, e nada alem delas', async () => {
  entrarComoCliente();
  abrirConta('/conta/pedidos/ME-260901-AB12');

  await screen.findByRole('heading', { name: 'ME-260901-AB12' });

  // Pedido entregue: cinco passos, e so dois com horario — o de criacao e o
  // da ultima mudanca. Os tres do meio aconteceram e a data nao existe deste
  // lado, entao a tela explica a ausencia em vez de inventar.
  const trilha = screen.getByText('Andamento').closest('section');

  expect(trilha).not.toBeNull();
  expect(within(trilha as HTMLElement).getAllByRole('time')).toHaveLength(2);
  expect(
    within(trilha as HTMLElement).getByText(/Os passos do meio ficam sem horario/),
  ).toBeTruthy();
});

test('o pedido de outra conta nao vira erro generico', async () => {
  entrarComoCliente();

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/customer/orders/')) {
        return Promise.resolve(jsonResponse({ message: 'Pedido nao encontrado.' }, 404));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIG));
      }

      return Promise.resolve(jsonResponse([]));
    }),
  );

  abrirConta('/conta/pedidos/ME-260901-ZZZZ');

  // O 404 do servidor quer dizer "nao e desta conta", e nao "quebrou". E o
  // motivo acionavel — o telefone — esta escrito.
  expect(await screen.findByRole('heading', { name: /nao esta nesta conta/ })).toBeTruthy();

  expect(screen.getByText(/ligados ao telefone informado no fechamento/)).toBeTruthy();
});
