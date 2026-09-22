// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { StoreSettingsProvider } from '@/features/settings';
import HomePage from './home-page';

/**
 * A home contra a API.
 *
 * O `fetch` e trocado por um duble que responde as seis rotas da pagina. E o
 * que permite verificar o que so se ve com dado de verdade: que o hero mostra
 * o banner cadastrado — o criterio de "trocar um banner muda a home sem
 * redeploy" —, que cada prateleira consome a rota dela, e que uma prateleira
 * vazia desaparece em vez de anunciar que a loja nao tem produto.
 */

const BANNERS = [
  {
    id: 'b1',
    imageDesktop: 'banners/verao-desktop',
    imageMobile: 'banners/verao-mobile',
    title: 'Colecao de verao',
    subtitle: 'Notas citricas para os dias quentes.',
    buttonLabel: 'Ver a colecao',
    link: '/produtos',
  },
  {
    id: 'b2',
    imageDesktop: 'banners/amadeirados-desktop',
    imageMobile: 'banners/amadeirados-mobile',
    title: 'Amadeirados',
    subtitle: 'Para a noite.',
    buttonLabel: 'Descobrir',
    link: '/categorias/amadeirados',
  },
];

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: 'Pronta entrega',
  contactEmail: 'contato@maisonessence.test',
  businessHours: 'Seg a sex, 9h as 18h',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: false,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: BANNERS,
};

const CATEGORIES = [
  { id: 'c1', name: 'Masculino', slug: 'masculino', image: '', productCount: 24, children: [] },
  { id: 'c2', name: 'Velas', slug: 'velas', image: '', productCount: 6, children: [] },
];

function produto(id: string, name: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    brand: 'Lattafa',
    images: ['produtos/foto'],
    coverImage: 'produtos/foto',
    variants: [
      {
        id: `${id}-v1`,
        label: '',
        priceCents: 18000,
        compareAtPriceCents: null,
        discountPercent: 0,
        stock: 3,
        isAvailable: true,
        onDemand: false,
        image: '',
      },
    ],
    hasVariants: false,
    priceRangeCents: { min: 18000, max: 18000 },
    discountPercent: 0,
    inStock: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    quantityDiscount: null,
    ...extras,
  };
}

/** O que cada rota responde. Um caso pode trocar uma entrada antes de montar. */
let prateleiras: Record<string, unknown[]>;
let chamadas: string[];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  chamadas = [];

  prateleiras = {
    featured: [produto('1', 'Asad', { isFeatured: true })],
    'ready-to-ship': [produto('2', 'Yara', { isReadyToShip: true })],
    'best-sellers': [produto('3', 'Fakhar')],
  };

  // O jsdom nao implementa `matchMedia`, e o carrossel o consulta para saber
  // se pode girar sozinho. Sem o duble, o hero quebra no primeiro render.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(url);

      for (const [nome, itens] of Object.entries(prateleiras)) {
        if (url.includes(`/products/${nome}`)) {
          return Promise.resolve(jsonResponse(itens));
        }
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(SETTINGS));
      }

      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse(CATEGORIES));
      }

      if (url.includes('/payment-settings')) {
        return Promise.resolve(jsonResponse({ pix: null, card: null }));
      }

      return Promise.resolve(jsonResponse([]));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function abrirHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <StoreSettingsProvider>
            <HomePage />
          </StoreSettingsProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

test('o hero mostra o banner cadastrado no painel', async () => {
  abrirHome();

  expect(await screen.findByRole('heading', { name: 'Colecao de verao' })).toBeDefined();
  expect(screen.getByText('Notas citricas para os dias quentes.')).toBeDefined();
  expect(screen.getByRole('link', { name: 'Ver a colecao' })).toBeDefined();
});

test('a primeira imagem do hero carrega sem lazy e com prioridade', async () => {
  const { container } = abrirHome();

  await screen.findByRole('heading', { name: 'Colecao de verao' });

  const imagens = [...container.querySelectorAll('picture img')];

  expect(imagens[0]?.getAttribute('loading')).toBe('eager');
  expect(imagens[0]?.getAttribute('fetchpriority')).toBe('high');

  // A segunda nao disputa banda com a primeira numa conexao lenta.
  expect(imagens[1]?.getAttribute('loading')).toBe('lazy');
});

test('o indicador troca o banner em exibicao', async () => {
  const user = userEvent.setup();

  abrirHome();

  const primeiro = await screen.findByRole('heading', { name: 'Colecao de verao' });
  const slide = primeiro.closest('[aria-roledescription="slide"]');

  expect(slide?.getAttribute('aria-hidden')).toBe('false');

  await user.click(screen.getByRole('button', { name: 'Banner 2 de 2' }));

  await waitFor(() => {
    expect(slide?.getAttribute('aria-hidden')).toBe('true');
  });

  const segundo = screen.getByRole('heading', { name: 'Amadeirados' });

  expect(segundo.closest('[aria-roledescription="slide"]')?.getAttribute('aria-hidden')).toBe(
    'false',
  );
});

test('as setas do teclado andam pelo carrossel', async () => {
  const user = userEvent.setup();

  abrirHome();

  const indicador = await screen.findByRole('button', { name: 'Banner 1 de 2' });

  indicador.focus();
  await user.keyboard('{ArrowRight}');

  const segundo = screen.getByRole('heading', { name: 'Amadeirados' });

  await waitFor(() => {
    expect(segundo.closest('[aria-roledescription="slide"]')?.getAttribute('aria-hidden')).toBe(
      'false',
    );
  });
});

test('a faixa de categorias mostra as categorias principais', async () => {
  abrirHome();

  expect(await screen.findByRole('link', { name: /Masculino/ })).toBeDefined();
  expect(screen.getByRole('link', { name: /Velas/ })).toBeDefined();
});

test('cada prateleira consome a rota dela', async () => {
  abrirHome();

  const destaques = await screen.findByRole('region', { name: 'Destaques' });
  const prontaEntrega = screen.getByRole('region', { name: 'Pronta entrega' });
  const maisVendidos = screen.getByRole('region', { name: 'Mais vendidos' });

  // `findBy`: a prateleira aparece com os esqueletos e so depois troca pelos
  // produtos — que e exatamente o que o criterio de "nenhum salto de layout"
  // pede. Um `getBy` aqui olharia para o esqueleto.
  expect(await within(destaques).findByRole('heading', { name: 'Asad' })).toBeDefined();
  expect(await within(prontaEntrega).findByRole('heading', { name: 'Yara' })).toBeDefined();
  expect(await within(maisVendidos).findByRole('heading', { name: 'Fakhar' })).toBeDefined();

  expect(chamadas.some((url) => url.includes('/products/best-sellers'))).toBe(true);
});

test('o produto de pronta entrega leva o selo verde na prateleira', async () => {
  abrirHome();

  const prontaEntrega = await screen.findByRole('region', { name: 'Pronta entrega' });

  expect(await within(prontaEntrega).findByText('Pronta entrega')).toBeDefined();
});

test('prateleira sem produto some da pagina', async () => {
  prateleiras['best-sellers'] = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Destaques' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Mais vendidos' })).toBeNull();
  });
});
