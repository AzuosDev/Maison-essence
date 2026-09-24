// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useCustomerSession } from '@/features/auth';
import { usePlacedOrders, type PlacedOrder } from '@/features/checkout';
import OrderConfirmationPage from './order-confirmation-page';

/**
 * A tela de confirmação.
 *
 * Três coisas são testadas aqui, e as três só aparecem depois que o pedido já
 * existe — o que faz delas as mais fáceis de quebrar sem ninguém perceber:
 *
 * 1. **O reenvio manda a URL do servidor, inteira.** E a segunda chance de
 *    quem teve a aba bloqueada, e ela só serve se a mensagem chegar do jeito
 *    que foi gravada, com as quebras de linha e os acentos.
 * 2. **O copiar entrega o texto sem codificação de URL.** Colar `%0A` numa
 *    conversa e pior do que não ter o botão.
 * 3. **A conta e convite, nunca parede.** Logado, o caminho para os pedidos;
 *    convidado, a oferta com o telefone do pedido já no link.
 */

vi.mock('@/lib/env', () => ({
  env: {
    VITE_API_URL: 'https://api.maisonessence.test/api/v1',
    VITE_CLOUDINARY_CLOUD_NAME: 'maison',
  },
}));

/** Com acento e com quebra de linha, que e o que se quer provar intacto. */
const MENSAGEM = [
  'Olá! Segue meu pedido na Maison Essence.',
  '',
  'Código: ME-260922-AB12',
  '1x Asad · 50ml — R$ 189,90',
  'Retirada na loja',
].join('\n');

const URL_WHATSAPP = `https://wa.me/5588999998888?text=${encodeURIComponent(MENSAGEM)}`;

const PEDIDO: PlacedOrder = {
  code: 'ME-260922-AB12',
  whatsappUrl: URL_WHATSAPP,
  whatsappMessage: MENSAGEM,
  customerName: 'Maria Silva',
  customerPhone: '88999998888',
  mode: 'pickup',
  cityName: '',
  itemCount: 1,
  totalCents: 18990,
  placedAt: '2026-09-22T12:00:00.000Z',
};

/** A aba de mentira, como no checkout: o jsdom não abre nenhuma. */
interface Abertura {
  abertaCom: string;
  /** A URL que a tela mandou para a aba, ou `null` se não mandou nenhuma. */
  enviadaPara: string | null;
}

let aberturas: Abertura[] = [];

/** O que foi parar na área de transferência. */
let copiado: string[] = [];

/**
 * Troca a área de transferência do jsdom pela nossa.
 *
 * **Chame depois de `userEvent.setup()`**, e nunca antes: a própria
 * biblioteca de eventos instala um substituto de `navigator.clipboard` ao ser
 * montada, e ele sobrescreveria este aqui — deixando o teste medindo o
 * substituto dela em vez do que a tela mandou copiar.
 */
function comAreaDeTransferencia(escrever: (texto: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(escrever) },
    configurable: true,
  });
}

/** A área de transferência que aceita tudo, e registra o que recebeu. */
function areaQueAceita(): void {
  comAreaDeTransferencia((texto) => {
    copiado.push(texto);

    return Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  usePlacedOrders.getState().clear();
  useCustomerSession.getState().signOut();

  aberturas = [];
  copiado = [];

  vi.stubGlobal(
    'open',
    vi.fn((url: string) => {
      const abertura: Abertura = { abertaCom: url, enviadaPara: null };

      aberturas.push(abertura);

      return {
        closed: false,
        opener: {},
        document: { write: vi.fn(), close: vi.fn() },
        location: {
          replace: (destino: string) => {
            abertura.enviadaPara = destino;
          },
        },
        focus: vi.fn(),
        close: vi.fn(),
      };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

function abrir(code = PEDIDO.code) {
  const router = createMemoryRouter(
    [
      { path: '/pedido/:code', element: <OrderConfirmationPage /> },
      { path: '/conta/criar', element: <p>Criar conta</p> },
      { path: '/conta/pedidos', element: <p>Meus pedidos</p> },
    ],
    { initialEntries: [`/pedido/${code}`] },
  );

  return render(<RouterProvider router={router} />);
}

function comPedidoFechado(): void {
  usePlacedOrders.setState({ orders: [PEDIDO] });
}

test('mostra o código do pedido e a instrução de conferir o WhatsApp', () => {
  comPedidoFechado();
  abrir();

  expect(screen.getByRole('heading', { name: 'Pedido finalizado' })).toBeTruthy();
  expect(screen.getByText('ME-260922-AB12')).toBeTruthy();
  expect(screen.getByText(/WhatsApp da loja/)).toBeTruthy();
});

test('reenviar manda a URL do servidor, sem reescrever a mensagem', async () => {
  const usuario = userEvent.setup();

  comPedidoFechado();
  abrir();

  await usuario.click(screen.getByRole('button', { name: /Reenviar pelo WhatsApp/ }));

  expect(aberturas.length).toBe(1);

  const enviada = aberturas[0]?.enviadaPara ?? '';

  expect(enviada).toBe(URL_WHATSAPP);

  // A prova do critério de aceite: o que chega ao WhatsApp, decodificado, e
  // a mensagem exata do pedido — com as quebras de linha e os acentos.
  expect(decodeURIComponent(enviada.split('?text=')[1] ?? '')).toBe(MENSAGEM);
});

test('copiar entrega o texto do pedido, e não a URL codificada', async () => {
  const usuario = userEvent.setup();

  areaQueAceita();
  comPedidoFechado();
  abrir();

  await usuario.click(screen.getByRole('button', { name: 'Copiar mensagem do pedido' }));

  await waitFor(() => {
    expect(copiado).toEqual([MENSAGEM]);
  });

  // E o botão confirma o que fez, no próprio rótulo.
  expect(await screen.findByRole('button', { name: /Mensagem copiada/ })).toBeTruthy();
});

test('sem área de transferência, o texto aparece selecionado para copiar a mão', async () => {
  const usuario = userEvent.setup();

  // O caso real: HTTP na rede local, WebView de aplicativo, navegador antigo.
  comAreaDeTransferencia(() => Promise.reject(new Error('sem permissão')));

  comPedidoFechado();
  abrir();

  await usuario.click(screen.getByRole('button', { name: 'Copiar mensagem do pedido' }));

  const campo = await screen.findByLabelText('Mensagem do pedido');

  expect(campo).toHaveProperty('value', MENSAGEM);
});

test('sem sessão, oferece a conta com o telefone do pedido já no link', () => {
  comPedidoFechado();
  abrir();

  const convite = screen.getByRole('link', { name: 'Criar minha conta' });

  expect(convite.getAttribute('href')).toBe('/conta/criar?telefone=88999998888');

  // E explica por que vale a pena, que e o que o cadastro tem de diferente
  // aqui: o pedido de convidado entra na conta pelo telefone.
  expect(screen.getByText(/aparece lá junto com tudo o que você já comprou/)).toBeTruthy();
});

test('com sessão, mostra o caminho para os pedidos da conta', () => {
  comPedidoFechado();

  useCustomerSession.getState().signIn(
    {
      id: 'cli-1',
      name: 'Maria Silva',
      phone: '88999998888',
      phoneLabel: '(88) 99999-8888',
      email: '',
      addresses: [],
      createdAt: '2026-09-01T12:00:00.000Z',
    },
    { accessToken: 'token', refreshToken: 'refresh' },
  );

  abrir();

  expect(screen.getByRole('link', { name: 'Ver meus pedidos' }).getAttribute('href')).toBe(
    '/conta/pedidos',
  );

  expect(screen.queryByRole('link', { name: 'Criar minha conta' })).toBeNull();
});

test('código que não esta neste navegador não vira erro', () => {
  abrir('ME-260922-ZZZZ');

  // O código continua em cena: e com ele que a loja acha a conversa.
  expect(screen.getByRole('heading', { name: 'Pedido ME-260922-ZZZZ' })).toBeTruthy();
  expect(screen.getByText(/não esta guardado neste navegador/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Voltar a loja' })).toBeTruthy();
});
