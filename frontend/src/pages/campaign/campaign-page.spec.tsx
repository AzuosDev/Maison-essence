// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import CampaignPage from './campaign-page';

/**
 * A vitrine da campanha contra a API.
 *
 * Tres coisas a provar, e a terceira e a que dói em produção:
 *
 * 1. **A lista sai filtrada pelo endereço.** O recorte vai no pedido ao
 *    servidor, e não e feito aqui.
 * 2. **O código e o prazo aparecem acima da lista**, com as palavras do
 *    servidor — a tela não escreve desconto nem conta cupom.
 * 3. **O endereço de uma campanha vencida diz que ela terminou.** O link da
 *    promoção circula no WhatsApp e no story, e story não expira junto com o
 *    cupom. Quem abre um endereço morto não pode ver a vitrine com um desconto
 *    que o fechamento já não da.
 */

/** Cada `fetch` que a tela fez, na ordem. */
let chamadas: string[];
/** A campanha do endereço, ou `null` para o 404. */
let campanha: Record<string, unknown> | null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function produto(nome: string) {
  const slug = nome.toLowerCase();

  return {
    id: slug,
    name: nome,
    slug,
    brand: 'Lattafa',
    images: ['produtos/foto'],
    coverImage: 'produtos/foto',
    variants: [
      {
        id: `${slug}-v1`,
        label: '',
        priceCents: 18_000,
        compareAtPriceCents: null,
        discountPercent: 0,
        stock: 3,
        isAvailable: true,
        onDemand: false,
        image: '',
      },
    ],
    hasVariants: false,
    priceRangeCents: { min: 18_000, max: 18_000 },
    discountPercent: 0,
    inStock: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    quantityDiscount: null,
  };
}

function campanhaNoAr(over: Record<string, unknown> = {}) {
  return {
    code: 'BLACKFRIDAY',
    title: 'Black Friday Maison',
    slug: 'black-friday-maison',
    tagline: 'Os cinco mais pedidos com desconto.',
    percentOff: 20,
    amountOffCents: null,
    discountLabel: '20% OFF',
    endsAt: null,
    wholeStore: false,
    scarcityLabel: '',
    ...over,
  };
}

beforeEach(() => {
  chamadas = [];
  campanha = campanhaNoAr();

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(url);

      if (url.includes('/campaigns/')) {
        return Promise.resolve(
          campanha === null
            ? jsonResponse({ message: 'Essa campanha nao esta no ar.' }, 404)
            : jsonResponse(campanha),
        );
      }

      if (url.includes('/payment-settings')) {
        return Promise.resolve(jsonResponse({ pix: null, card: null }));
      }

      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes('/products')) {
        const items = [produto('Asad'), produto('Yara')];

        return Promise.resolve(
          jsonResponse({ items, page: 1, totalPages: 1, totalItems: 2, hasMore: false }),
        );
      }

      return Promise.resolve(jsonResponse([]));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();

  for (const node of document.head.querySelectorAll('[data-page-meta]')) {
    node.remove();
  }
});

function abrir(rota = '/promocao/black-friday-maison') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            <Route path="/promocao/:slug" element={<CampaignPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** As consultas de produto, com os parâmetros que a tela mandou. */
function listagens(): URLSearchParams[] {
  return chamadas
    .filter((url) => url.includes('/products?'))
    .map((url) => new URLSearchParams(url.split('?')[1] ?? ''));
}

/* ---- A vitrine ------------------------------------------------------------ */

test('a lista sai filtrada pelo endereço da campanha', async () => {
  abrir();

  await screen.findByRole('heading', { name: 'Asad' });

  expect(listagens().length).toBeGreaterThan(0);

  // Todas as consultas de produto levam o recorte, inclusive a das facetas da
  // barra de filtros: uma marca que não esta na campanha não pode aparecer no
  // filtro de uma vitrine que não a mostra.
  for (const pedido of listagens()) {
    expect(pedido.get('campaign')).toBe('black-friday-maison');
  }
});

test('o título e a linha de apoio da campanha abrem a página', async () => {
  abrir();

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Black Friday Maison' }),
  ).toBeDefined();

  expect(screen.getByText('Os cinco mais pedidos com desconto.')).toBeTruthy();
});

test('o desconto, o código e o prazo aparecem com as palavras do servidor', async () => {
  const hoje = new Date();
  hoje.setHours(23, 59, 0, 0);

  campanha = campanhaNoAr({ endsAt: hoje.toISOString(), scarcityLabel: 'Restam 2 cupons' });

  abrir();

  await screen.findByRole('heading', { level: 1, name: 'Black Friday Maison' });

  expect(screen.getByText('20% OFF')).toBeTruthy();
  expect(screen.getByText('BLACKFRIDAY')).toBeTruthy();
  expect(screen.getByText('Último dia')).toBeTruthy();
  expect(screen.getByText('Restam 2 cupons')).toBeTruthy();
});

/*
 * A frase que fecha o circuito. Sem ela o retângulo com o código e um enfeite:
 * ninguém e obrigado a saber que cupom se digita no fechamento.
 */
test('a página diz onde o cupom se aplica', async () => {
  abrir();

  expect(await screen.findByText('Aplique o cupom no fechamento do pedido.')).toBeDefined();
});

test('a campanha que acabou diz que acabou, e não mostra vitrine nenhuma', async () => {
  campanha = null;

  abrir('/promocao/natal-2025');

  expect(await screen.findByRole('heading', { name: 'Essa promoção terminou' })).toBeDefined();

  // Nenhum produto, e nenhum código que sugira que o cupom ainda vale.
  expect(screen.queryByRole('heading', { name: 'Asad' })).toBeNull();
  expect(screen.queryByText('BLACKFRIDAY')).toBeNull();

  // E dois caminhos de volta, porque quem chegou aqui queria comprar.
  const promocoes = screen.getByRole('link', { name: 'Ver as promoções' });
  expect(promocoes.getAttribute('href')).toBe('/produtos?desconto=1');
});

/*
 * O bloco da oferta reserva a própria altura enquanto a campanha não chegou. A
 * lista de produtos sai em paralelo e costuma responder antes — sem a reserva,
 * a grade nasceria no lugar errado e desceria quando o desconto aparecesse.
 */
test('o bloco da oferta ocupa o lugar dele antes de a campanha chegar', () => {
  const { container } = abrir();

  const aguardando = container.querySelector('[aria-busy="true"]');

  expect(aguardando).not.toBeNull();
  expect(within(aguardando as HTMLElement).queryByText('20% OFF')).toBeNull();
});
