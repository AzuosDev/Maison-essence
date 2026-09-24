// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCart } from '@/features/cart';
import { useCheckout, usePlacedOrders } from '@/features/checkout';
import { StoreSettingsProvider } from '@/features/settings';
import OrderConfirmationPage from '@/pages/order/order-confirmation-page';
import CheckoutPage from './checkout-page';

/**
 * O checkout contra a API.
 *
 * Os criterios de aceite escritos como codigo, mais os dois erros que a
 * revisao visual nunca pega:
 *
 * 1. **Retirada some com o endereco e zera a taxa.** Os campos saem da tela
 *    e o corpo enviado ao servidor sai sem cidade nenhuma.
 * 2. **Trocar a cidade muda a taxa e o total na hora.** Conferido no que foi
 *    *pedido* ao servidor e no que foi *exibido* — e o total exibido e um
 *    numero que nenhuma conta local produziria.
 * 3. **Recarregar no meio nao perde nada.** Testado desmontando e montando a
 *    pagina de novo, com o `localStorage` no meio.
 * 4. **Duplo clique gera um pedido so.** O erro mais comum desta tela, e o
 *    unico que produz duas conversas no WhatsApp da dona.
 * 5. **O 409 abre o modal comparando os dois valores**, e nao reenvia nada
 *    por conta propria.
 *
 * E o fecho, que e o momento em que o sistema todo entrega ou nao entrega:
 *
 * 6. **A aba do WhatsApp e reservada no clique** e recebe exatamente a URL
 *    que o servidor mandou — com as quebras de linha e os acentos como
 *    ficaram gravados no pedido.
 * 7. **Erro na criacao nao esvazia a sacola.** O criterio de aceite mais
 *    caro de descobrir em producao.
 * 8. **O 429 pede para esperar** em vez de oferecer um botao que so pode
 *    falhar de novo.
 * 9. **O 409 de estoque tira da sacola o item que acabou**, sem obrigar o
 *    cliente a procurar qual foi.
 */

vi.mock('@/lib/env', () => ({
  env: {
    VITE_API_URL: 'https://api.maisonessence.test/api/v1',
    VITE_CLOUDINARY_CLOUD_NAME: 'maison',
  },
}));

const CIDADES = [
  {
    id: 'c-juazeiro',
    name: 'Juazeiro do Norte',
    state: 'CE',
    feeCents: 1500,
    feeLabel: 'R$ 15,00',
    estimatedDays: 2,
    estimatedLabel: 'Ate 2 dias uteis',
    freeFromCents: null,
    freeFromLabel: '',
  },
  {
    id: 'c-crato',
    name: 'Crato',
    state: 'CE',
    feeCents: 2500,
    feeLabel: 'R$ 25,00',
    estimatedDays: 3,
    estimatedLabel: 'Ate 3 dias uteis',
    freeFromCents: null,
    freeFromLabel: '',
  },
];

const CONFIGURACOES = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: '',
  contactEmail: '',
  businessHours: 'Seg a sex, 9h as 18h',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: true,
  pickupAddress: {
    street: 'Rua Sao Pedro',
    number: '100',
    complement: '',
    district: 'Centro',
    city: 'Juazeiro do Norte',
    state: 'CE',
    zipCode: '63010000',
    reference: '',
  },
  pickupInstructions: 'Avise uma hora antes de vir.',
  freeShippingMinCents: null,
  banners: [],
};

const PAGAMENTOS = {
  pix: { keyType: 'phone', hasKey: true, discountPercent: 5 },
  card: {
    maxInstallments: 6,
    interestFreeUpTo: 3,
    monthlyInterestPercent: 2.5,
    minInstallmentCents: 2000,
  },
};

function itemCotado(overrides: Record<string, unknown> = {}) {
  return {
    productId: '507f1f77bcf86cd799439011',
    variantId: '507f1f77bcf86cd799439012',
    productName: 'Asad',
    productSlug: 'asad-lattafa',
    variantLabel: '50ml',
    image: 'produtos/asad-50',
    quantity: 1,
    unitPriceCents: 18990,
    availableStock: 8,
    allowBackorder: false,
    discountPercent: 0,
    discountCents: 0,
    lineTotalCents: 18990,
    unavailable: false,
    unavailableReason: '',
    ...overrides,
  };
}

/**
 * Uma cotacao como o servidor a devolveria.
 *
 * O total **nao** e a soma das linhas com a taxa: e um numero proprio,
 * passado de fora. E o que permite os casos abaixo provarem que a tela
 * exibe o que o servidor mandou, e nao o que ela mesma somaria.
 */
function cotacao(options: {
  items?: Record<string, unknown>[];
  mode?: 'delivery' | 'pickup';
  cityId?: string | null;
  cityName?: string;
  feeCents?: number;
  totalCents: number;
  installmentOptions?: unknown[];
  pixDiscountCents?: number;
}) {
  const items = options.items ?? [itemCotado()];

  return {
    items,
    fulfillment: {
      mode: options.mode ?? 'pickup',
      cityId: options.cityId ?? null,
      cityName: options.cityName ?? '',
      state: options.cityName === undefined ? '' : 'CE',
      estimatedDays: 2,
      requiresAddress: (options.mode ?? 'pickup') === 'delivery',
      feeCents: options.feeCents ?? 0,
      isFree: (options.feeCents ?? 0) === 0,
      freeReason: (options.feeCents ?? 0) === 0 ? 'Retirada na loja' : '',
      missingForFreeCents: null,
    },
    payment: { method: 'card', installments: 1, selected: null },
    subtotalCents: 18990,
    discountTotalCents: 0,
    deliveryFeeCents: options.feeCents ?? 0,
    pixDiscountCents: options.pixDiscountCents ?? 0,
    totalCents: options.totalCents,
    installmentOptions: options.installmentOptions ?? [],
    warnings: [],
  };
}

/**
 * A mensagem do pedido, com o que o criterio de aceite cobra: quebra de linha
 * de verdade e acentuacao de verdade.
 *
 * Escrita com acento **de proposito**, ao contrario dos comentarios deste
 * projeto: e exatamente o que se quer provar que atravessa o caminho inteiro
 * sem ser reescrito.
 */
const MENSAGEM = [
  'Olá! Segue meu pedido na Maison Essence.',
  '',
  'Código: ME-260922-AB12',
  '1x Asad · 50ml — R$ 189,90',
  'Retirada na loja · Pagamento em PIX',
].join('\n');

/** A URL como o servidor a monta: `wa.me` mais a mensagem codificada. */
const URL_WHATSAPP = `https://wa.me/5588999998888?text=${encodeURIComponent(MENSAGEM)}`;

/** A resposta de `POST /orders`, inteira, como `order.view.ts` a devolve. */
function pedidoCriado() {
  return {
    orderId: 'o1',
    code: 'ME-260922-AB12',
    whatsappUrl: URL_WHATSAPP,
    order: {
      id: 'o1',
      code: 'ME-260922-AB12',
      status: 'PENDING_CONTACT',
      items: [
        {
          productId: '507f1f77bcf86cd799439011',
          variantId: '507f1f77bcf86cd799439012',
          productName: 'Asad',
          variantLabel: '50ml',
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
        email: '',
      },
      fulfillment: {
        mode: 'pickup',
        cityId: null,
        cityName: '',
        state: '',
        estimatedDays: 0,
        address: null,
      },
      payment: { method: 'pix', installments: 1, hasInterest: false },
      totals: {
        subtotalCents: 18990,
        discountTotalCents: 0,
        deliveryFeeCents: 0,
        pixDiscountCents: 0,
        totalCents: 18990,
      },
      whatsappMessage: MENSAGEM,
      createdAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z',
    },
  };
}

/**
 * Uma aba de navegador de mentira.
 *
 * O jsdom nao abre abas: `window.open` devolve `null`, e com isso o codigo
 * cairia direto no caminho de emergencia — que nao e o que estes casos
 * querem observar. Com o dublê, da para conferir as duas coisas que importam:
 * que a aba foi pedida **vazia** durante o clique, e que a URL do servidor
 * chegou nela sem passar por nenhuma reescrita.
 */
interface AbaFalsa {
  abertaCom: string;
  /** A URL que a tela mandou para esta aba, ou `null` se nao mandou nenhuma. */
  enviadaPara: string | null;
  closed: boolean;
  opener: unknown;
  document: { write: (html: string) => void; close: () => void };
  location: { replace: (url: string) => void };
  focus: () => void;
  close: () => void;
}

/** As abas que a tela pediu ao navegador, na ordem. */
let abas: AbaFalsa[] = [];

function comAbas(): void {
  vi.stubGlobal(
    'open',
    vi.fn((url: string): AbaFalsa => {
      const aba: AbaFalsa = {
        abertaCom: url,
        enviadaPara: null,
        closed: false,
        opener: {},
        document: { write: vi.fn(), close: vi.fn() },
        location: {
          replace: (destino: string) => {
            aba.enviadaPara = destino;
          },
        },
        focus: vi.fn(),
        close: vi.fn(() => {
          aba.closed = true;
        }),
      };

      abas.push(aba);

      return aba;
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Os corpos que a tela mandou para `POST /cart/quote`, em ordem. */
let quoteRequests: {
  fulfillment: { mode: string; cityId?: string };
  payment: { method: string; installments?: number };
}[] = [];

/** Os corpos que a tela mandou para `POST /orders`. */
let orderRequests: Record<string, unknown>[] = [];

/** Quem responde a cotacao. Trocado por caso, conforme o que se quer provar. */
let quoteFor: (body: { fulfillment: { mode: string; cityId?: string } }) => unknown;

/** A resposta de `POST /orders`: sucesso por padrao. */
let orderResponse: () => Response;

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ lines: [], hints: {}, drawerOpen: false });
  useCheckout.getState().reset();
  usePlacedOrders.getState().clear();

  quoteRequests = [];
  orderRequests = [];
  abas = [];

  quoteFor = () => cotacao({ totalCents: 18990 });

  orderResponse = () => jsonResponse(pedidoCriado(), 201);

  comAbas();

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/cart/quote')) {
        const body = JSON.parse(String(init?.body));

        quoteRequests.push(body);

        return Promise.resolve(jsonResponse(quoteFor(body)));
      }

      if (url.includes('/orders')) {
        orderRequests.push(JSON.parse(String(init?.body)));

        return Promise.resolve(orderResponse());
      }

      if (url.includes('/delivery-cities')) {
        return Promise.resolve(jsonResponse(CIDADES));
      }

      if (url.includes('/payment-settings')) {
        return Promise.resolve(jsonResponse(PAGAMENTOS));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIGURACOES));
      }

      if (url.includes('/pages')) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse(null));
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

function abrirCheckout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  // A confirmacao entra no roteador porque o fecho termina nela: depois do
  // `201` a pagina navega para `/pedido/:code`, e sem a rota o teste nao
  // veria o que o cliente ve. `/sacola` responde pelo caminho da sacola
  // esvaziada.
  const router = createMemoryRouter(
    [
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/pedido/:code', element: <OrderConfirmationPage /> },
      { path: '/sacola', element: <p>A sacola</p> },
    ],
    { initialEntries: ['/checkout'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <StoreSettingsProvider>
          <RouterProvider router={router} />
        </StoreSettingsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function comUmItem() {
  useCart.setState({
    lines: [
      { productId: '507f1f77bcf86cd799439011', variantId: '507f1f77bcf86cd799439012', quantity: 1 },
    ],
    hints: {
      '507f1f77bcf86cd799439011:507f1f77bcf86cd799439012': {
        name: 'Asad',
        slug: 'asad-lattafa',
        variantLabel: '50ml',
        image: '',
      },
    },
  });
}

/** O total, lido do bloco de resumo e nao de qualquer "R$" da tela. */
function totalDoResumo(): string {
  const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });

  return within(resumo).getByText(/^R\$/, { selector: 'strong' }).textContent ?? '';
}

async function avancar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

/* ---- Os criterios de aceite ----------------------------------------------- */

test('escolher retirada some com os campos de endereco e zera a taxa', async () => {
  const usuario = userEvent.setup();

  comUmItem();

  quoteFor = (body) =>
    body.fulfillment.mode === 'pickup'
      ? cotacao({ mode: 'pickup', totalCents: 18990 })
      : cotacao({ mode: 'delivery', cityId: 'c-crato', feeCents: 2500, totalCents: 21490 });

  abrirCheckout();

  await screen.findByRole('heading', { name: 'Seus itens' });
  await avancar(usuario);

  // Pela entrega primeiro: e assim que se prova que os campos existiam antes
  // de sumirem.
  await usuario.click(screen.getByRole('radio', { name: /Receber em casa/ }));
  expect(screen.getByLabelText('Rua')).toBeTruthy();

  await usuario.click(screen.getByRole('radio', { name: /Retirar na loja/ }));

  expect(screen.queryByLabelText('Rua')).toBeNull();
  expect(screen.queryByLabelText('Bairro')).toBeNull();
  expect(screen.queryByLabelText('Cidade da entrega')).toBeNull();

  // O endereco da loja entra no lugar dos campos.
  expect(screen.getByText(/Rua Sao Pedro/)).toBeTruthy();

  // E a taxa sai da conta: o corpo da cotacao vai sem cidade, e o resumo
  // mostra o total sem frete.
  await waitFor(() => {
    expect(quoteRequests.at(-1)?.fulfillment).toEqual({ mode: 'pickup' });
  });

  await waitFor(() => {
    expect(totalDoResumo()).toBe('R$ 189,90');
  });
});

test('trocar a cidade muda a taxa e o total na hora', async () => {
  const usuario = userEvent.setup();

  comUmItem();

  /**
   * Totais que nenhuma conta local produziria.
   *
   * Juazeiro devolve R$ 300,00 e Crato R$ 400,00, com subtotal de R$ 189,90
   * e taxas de R$ 15,00 e R$ 25,00. Se a tela somasse por conta propria,
   * mostraria R$ 204,90 e R$ 214,90 — e o caso falharia.
   */
  quoteFor = (body) => {
    if (body.fulfillment.mode !== 'delivery') {
      return cotacao({ mode: 'pickup', totalCents: 18990 });
    }

    return body.fulfillment.cityId === 'c-juazeiro'
      ? cotacao({
          mode: 'delivery',
          cityId: 'c-juazeiro',
          cityName: 'Juazeiro do Norte',
          feeCents: 1500,
          totalCents: 30000,
        })
      : cotacao({
          mode: 'delivery',
          cityId: 'c-crato',
          cityName: 'Crato',
          feeCents: 2500,
          totalCents: 40000,
        });
  };

  abrirCheckout();

  await screen.findByRole('heading', { name: 'Seus itens' });
  await avancar(usuario);

  await usuario.click(screen.getByRole('radio', { name: /Receber em casa/ }));
  await usuario.selectOptions(await screen.findByLabelText('Cidade da entrega'), 'c-juazeiro');

  await waitFor(() => {
    expect(totalDoResumo()).toBe('R$ 300,00');
  });

  const resumo = screen.getByRole('complementary', { name: 'Resumo do pedido' });

  expect(within(resumo).getByText('R$ 15,00')).toBeTruthy();

  await usuario.selectOptions(screen.getByLabelText('Cidade da entrega'), 'c-crato');

  await waitFor(() => {
    expect(totalDoResumo()).toBe('R$ 400,00');
  });

  expect(within(resumo).getByText('R$ 25,00')).toBeTruthy();

  // E a conta foi refeita pelo servidor, com a cidade nova no corpo.
  expect(quoteRequests.at(-1)?.fulfillment).toEqual({
    mode: 'delivery',
    cityId: 'c-crato',
  });
});

test('recarregar no meio do checkout nao perde nada', async () => {
  const usuario = userEvent.setup();

  comUmItem();

  const primeira = abrirCheckout();

  await screen.findByRole('heading', { name: 'Seus itens' });
  await avancar(usuario);

  await usuario.click(screen.getByRole('radio', { name: /Receber em casa/ }));
  await usuario.selectOptions(await screen.findByLabelText('Cidade da entrega'), 'c-crato');
  await usuario.type(screen.getByLabelText('Rua'), 'Rua das Flores');
  await usuario.type(screen.getByLabelText('Bairro'), 'Centro');
  await usuario.type(screen.getByLabelText('Ponto de referencia'), 'Perto da praca');

  /**
   * A recarga.
   *
   * O navegador fechou a pagina: a arvore e descartada, o estado em memoria
   * some, e o unico elo com o que vem depois e o que ficou gravado no
   * `localStorage`. E por isso que o conteudo gravado e lido **antes** de o
   * store ser zerado e reposto logo em seguida — zerar o store dispara a
   * persistencia e reescreveria o armazenamento com o estado vazio, o que
   * nenhuma recarga de verdade faz.
   */
  const gravado = localStorage.getItem('maison-essence.checkout');

  primeira.unmount();
  useCheckout.setState(useCheckout.getInitialState(), true);
  localStorage.setItem('maison-essence.checkout', String(gravado));
  await useCheckout.persist.rehydrate();

  abrirCheckout();

  // Voltou no mesmo passo...
  await screen.findByRole('heading', { name: 'Entrega ou retirada' });

  // ...com as mesmas escolhas e o mesmo texto digitado.
  expect(screen.getByRole('radio', { name: /Receber em casa/ })).toHaveProperty('checked', true);

  // A cidade espera a lista de `/delivery-cities` chegar: o id guardado so
  // casa com uma opcao depois que as opcoes existem. E o que deve acontecer
  // — guardar o nome em vez do id faria a cidade renomeada no painel voltar
  // escrita errado na tela de quem estava no meio do checkout.
  await waitFor(() => {
    expect(screen.getByLabelText('Cidade da entrega')).toHaveProperty('value', 'c-crato');
  });

  expect(screen.getByLabelText('Rua')).toHaveProperty('value', 'Rua das Flores');
  expect(screen.getByLabelText('Bairro')).toHaveProperty('value', 'Centro');
  expect(screen.getByLabelText('Ponto de referencia')).toHaveProperty('value', 'Perto da praca');
});

/* ---- Os dois erros que a revisao visual nao pega -------------------------- */

test('duplo clique em finalizar gera um pedido so', async () => {
  const usuario = userEvent.setup();

  comUmItem();
  await irAteARevisao(usuario);

  const finalizar = screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' });

  // Dois cliques seguidos, sem esperar o primeiro responder.
  await Promise.all([usuario.click(finalizar), usuario.click(finalizar)]);

  await waitFor(() => {
    expect(orderRequests.length).toBe(1);
  });

  // E o pedido foi com o total que estava na tela, para o servidor conferir.
  expect(orderRequests[0]?.expectedTotalCents).toBe(18990);
});

test('o 409 abre o modal comparando os dois valores, sem reenviar sozinho', async () => {
  const usuario = userEvent.setup();

  comUmItem();

  orderResponse = () =>
    jsonResponse(
      {
        statusCode: 409,
        message: 'O valor do pedido mudou desde que voce montou a sacola.',
        error: 'Conflict',
        details: {
          reason: 'total',
          quote: cotacao({ mode: 'pickup', totalCents: 21990 }),
        },
        timestamp: new Date().toISOString(),
        path: '/orders',
      },
      409,
    );

  await irAteARevisao(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' }));

  const modal = await screen.findByRole('dialog');

  expect(within(modal).getByText('R$ 189,90')).toBeTruthy();
  expect(within(modal).getByText('R$ 219,90')).toBeTruthy();

  // Um pedido enviado, e nenhum reenvio por conta propria.
  expect(orderRequests.length).toBe(1);

  // A confirmacao reenvia com o total novo — e so entao.
  orderResponse = () => jsonResponse(pedidoCriado(), 201);

  await usuario.click(within(modal).getByRole('button', { name: 'Continuar com o novo valor' }));

  await waitFor(() => {
    expect(orderRequests.length).toBe(2);
  });

  expect(orderRequests[1]?.expectedTotalCents).toBe(21990);
});

/* ---- O fecho --------------------------------------------------------------- */

test('a aba do WhatsApp e reservada no clique e recebe a URL do servidor', async () => {
  const usuario = userEvent.setup();

  await irAteARevisao(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' }));

  // A aba foi pedida **vazia**, ainda dentro do clique. E o ponto inteiro do
  // desenho: o Safari do iOS recusa `window.open` chamado depois da promessa
  // do `POST`, e o pedido ficaria criado sem a conversa acontecer.
  expect(abas.length).toBe(1);
  expect(abas[0]?.abertaCom).toBe('');

  await waitFor(() => {
    expect(abas[0]?.enviadaPara).toBe(URL_WHATSAPP);
  });

  /**
   * A URL foi entregue byte a byte.
   *
   * O criterio de aceite fala em quebra de linha correta e acento integro, e
   * e isto que garante os dois: a tela nao remonta nem recodifica nada — ela
   * repassa a string que o servidor gravou no pedido. Conferir a igualdade
   * exata e mais forte do que procurar `%0A` no meio dela, porque qualquer
   * reescrita, inclusive uma que "arrumasse" o texto, quebra o caso.
   */
  const enviada = abas[0]?.enviadaPara ?? '';

  expect(decodeURIComponent(enviada.split('?text=')[1] ?? '')).toBe(MENSAGEM);

  // E a confirmacao entrou no lugar do checkout, com o codigo do pedido.
  expect(await screen.findByText('ME-260922-AB12')).toBeTruthy();

  // E nao a sacola vazia. A guarda de "sacola vazia nao tem checkout" corre
  // junto com esta navegacao — esvaziar a sacola e ir para a confirmacao
  // acontecem no mesmo instante —, e ja mandou a pessoa para `/sacola` bem
  // na hora em que o pedido dera certo.
  expect(screen.queryByText('A sacola')).toBeNull();
});

test('erro na criacao do pedido nao esvazia o carrinho', async () => {
  const usuario = userEvent.setup();

  orderResponse = () =>
    jsonResponse(
      {
        statusCode: 500,
        message: 'Nao foi possivel registrar o pedido agora.',
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
        path: '/orders',
      },
      500,
    );

  await irAteARevisao(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' }));

  await screen.findByRole('alert');

  // O criterio de aceite: a sacola esta como estava.
  expect(useCart.getState().lines.length).toBe(1);

  // E a aba reservada foi fechada, em vez de ficar em branco atras da tela.
  await waitFor(() => {
    expect(abas[0]?.closed).toBe(true);
  });

  // O caminho de volta e repetir o mesmo pedido, sem refazer as quatro
  // etapas.
  orderResponse = () => jsonResponse(pedidoCriado(), 201);

  await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));

  await waitFor(() => {
    expect(orderRequests.length).toBe(2);
  });

  expect(orderRequests[1]).toEqual(orderRequests[0]);
});

test('o 429 pede para esperar em vez de oferecer o reenvio na hora', async () => {
  const usuario = userEvent.setup();

  orderResponse = () =>
    jsonResponse(
      {
        statusCode: 429,
        message: 'Muitas requisicoes em pouco tempo. Espere um instante e tente de novo.',
        error: 'Too Many Requests',
        timestamp: new Date().toISOString(),
        path: '/orders',
      },
      429,
    );

  await irAteARevisao(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' }));

  const aviso = await screen.findByRole('alert');

  expect(within(aviso).getByText('Muitas tentativas seguidas')).toBeTruthy();

  // O botao existe, e esta fora do ar: quem chega aqui costuma ter enviado o
  // pedido varias vezes, e uma dessas pode ter passado.
  const esperar = within(aviso).getByRole('button', { name: /Tentar de novo em \d+s/ });

  expect(esperar).toHaveProperty('disabled', true);

  // A sacola, de novo, intacta.
  expect(useCart.getState().lines.length).toBe(1);
});

test('o 409 de estoque tira da sacola o item que acabou', async () => {
  const usuario = userEvent.setup();

  orderResponse = () =>
    jsonResponse(
      {
        statusCode: 409,
        message: 'A ultima unidade de um dos itens acabou de ser vendida.',
        error: 'Conflict',
        timestamp: new Date().toISOString(),
        path: '/orders',
        details: {
          reason: 'stock',
          quote: cotacao({
            mode: 'pickup',
            totalCents: 0,
            items: [
              itemCotado({
                unavailable: true,
                unavailableReason: 'Sem estoque no momento',
              }),
            ],
          }),
        },
      },
      409,
    );

  await irAteARevisao(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' }));

  const modal = await screen.findByRole('dialog');

  // O modal nomeia o item, em vez de mandar o cliente procurar qual foi.
  expect(within(modal).getByText(/Sem estoque no momento/)).toBeTruthy();

  // E nao oferece "continuar com o novo valor": nao ha valor a aceitar, ha
  // item a tirar.
  expect(within(modal).queryByRole('button', { name: 'Continuar com o novo valor' })).toBeNull();

  await usuario.click(within(modal).getByRole('button', { name: 'Remover o item' }));

  await waitFor(() => {
    expect(useCart.getState().lines.length).toBe(0);
  });

  // Nenhum segundo pedido saiu por conta propria.
  expect(orderRequests.length).toBe(1);
});

/** Atravessa os tres primeiros passos com retirada e PIX. */
async function irAteARevisao(usuario: ReturnType<typeof userEvent.setup>) {
  comUmItem();
  abrirCheckout();

  await screen.findByRole('heading', { name: 'Seus itens' });
  await avancar(usuario);

  await usuario.click(await screen.findByRole('radio', { name: /Retirar na loja/ }));
  await avancar(usuario);

  await usuario.click(await screen.findByRole('radio', { name: /^PIX/ }));
  await avancar(usuario);

  await screen.findByRole('heading', { name: 'Seus dados' });
  await usuario.type(screen.getByLabelText('Nome'), 'Maria Silva');
  await usuario.type(screen.getByLabelText('WhatsApp'), '88999998888');
}
