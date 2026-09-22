// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useCart } from '@/features/cart';
import { useCheckout } from '@/features/checkout';
import { StoreSettingsProvider } from '@/features/settings';
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
  mode?: 'DELIVERY' | 'PICKUP';
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
      mode: options.mode ?? 'PICKUP',
      cityId: options.cityId ?? null,
      cityName: options.cityName ?? '',
      state: options.cityName === undefined ? '' : 'CE',
      estimatedDays: 2,
      requiresAddress: (options.mode ?? 'PICKUP') === 'DELIVERY',
      feeCents: options.feeCents ?? 0,
      isFree: (options.feeCents ?? 0) === 0,
      freeReason: (options.feeCents ?? 0) === 0 ? 'Retirada na loja' : '',
      missingForFreeCents: null,
    },
    payment: { method: 'CARD', installments: 1, selected: null },
    subtotalCents: 18990,
    discountTotalCents: 0,
    deliveryFeeCents: options.feeCents ?? 0,
    pixDiscountCents: options.pixDiscountCents ?? 0,
    totalCents: options.totalCents,
    installmentOptions: options.installmentOptions ?? [],
    warnings: [],
  };
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

  quoteRequests = [];
  orderRequests = [];

  quoteFor = () => cotacao({ totalCents: 18990 });

  orderResponse = () =>
    jsonResponse(
      {
        orderId: 'o1',
        code: 'ME-260922-AB12',
        whatsappUrl: 'https://wa.me/5588999998888?text=pedido',
        order: {},
      },
      201,
    );

  // A ida para o `wa.me` nao e simulada: o jsdom apenas registra "navigation
  // not implemented" e segue. O que estes casos conferem e o que foi
  // **enviado** ao servidor — quem abre a conversa e assunto do passo
  // seguinte do plano, e tera o seu proprio caso.

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

  const router = createMemoryRouter([{ path: '/checkout', element: <CheckoutPage /> }], {
    initialEntries: ['/checkout'],
  });

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
    body.fulfillment.mode === 'PICKUP'
      ? cotacao({ mode: 'PICKUP', totalCents: 18990 })
      : cotacao({ mode: 'DELIVERY', cityId: 'c-crato', feeCents: 2500, totalCents: 21490 });

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
    expect(quoteRequests.at(-1)?.fulfillment).toEqual({ mode: 'PICKUP' });
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
    if (body.fulfillment.mode !== 'DELIVERY') {
      return cotacao({ mode: 'PICKUP', totalCents: 18990 });
    }

    return body.fulfillment.cityId === 'c-juazeiro'
      ? cotacao({
          mode: 'DELIVERY',
          cityId: 'c-juazeiro',
          cityName: 'Juazeiro do Norte',
          feeCents: 1500,
          totalCents: 30000,
        })
      : cotacao({
          mode: 'DELIVERY',
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
    mode: 'DELIVERY',
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
          quote: cotacao({ mode: 'PICKUP', totalCents: 21990 }),
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
  orderResponse = () =>
    jsonResponse(
      {
        orderId: 'o1',
        code: 'ME-260922-AB12',
        whatsappUrl: 'https://wa.me/5588999998888?text=pedido',
        order: {},
      },
      201,
    );

  await usuario.click(within(modal).getByRole('button', { name: 'Continuar com o novo valor' }));

  await waitFor(() => {
    expect(orderRequests.length).toBe(2);
  });

  expect(orderRequests[1]?.expectedTotalCents).toBe(21990);
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
