// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StoreLayout } from '@/app/layouts/store-layout';
import headerStyles from './store-header.module.css';

/**
 * A moldura da loja contra a API.
 *
 * O `fetch` e trocado por um duble que responde as tres rotas que o layout
 * consome. E o que permite verificar o que so se ve com dado de verdade: que
 * o menu mostra as categorias cadastradas, que a barra de avisos mostra o
 * texto do painel e que o botao do WhatsApp aponta para o numero
 * configurado — em vez de conferir isso a olho depois de cada mudanca.
 */

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: 'Frete fixo para o Cariri · Pronta entrega',
  contactEmail: 'contato@maisonessence.test',
  businessHours: 'Seg a sex, 9h as 18h',
  socialLinks: { instagram: 'https://instagram.com/maison', tiktok: '' },
  pickupEnabled: true,
  pickupAddress: {
    street: 'Rua das Flores',
    number: '10',
    complement: '',
    district: 'Centro',
    city: 'Juazeiro do Norte',
    state: 'CE',
    zipCode: '63010000',
    reference: '',
  },
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

const PAGES = [
  { slug: 'quem-somos', title: 'Quem somos' },
  { slug: 'trocas-e-devolucoes', title: 'Trocas e devolucoes' },
];

const CATEGORIES = [
  {
    id: '1',
    name: 'Masculino',
    slug: 'masculino',
    image: '',
    productCount: 24,
    children: [{ id: '11', name: 'Amadeirados', slug: 'amadeirados', image: '', productCount: 9 }],
  },
  {
    id: '2',
    name: 'Velas aromaticas',
    slug: 'velas-aromaticas',
    image: '',
    productCount: 6,
    children: [],
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(SETTINGS));
      }

      if (url.includes('/pages')) {
        return Promise.resolve(jsonResponse(PAGES));
      }

      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse(CATEGORIES));
      }

      return Promise.resolve(jsonResponse({ items: [], page: 1, totalPages: 1, totalItems: 0 }));
    }),
  );

  // O observador do rodape nao existe no jsdom. O botao do WhatsApp so o usa
  // para decidir se sobe, e nao para aparecer.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function abrirLoja() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<p>Vitrine</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('a barra de avisos mostra o texto cadastrado no painel', async () => {
  abrirLoja();

  // Duas copias no markup: a segunda e `aria-hidden` e existe so para o
  // texto reentrar pela direita sem intervalo.
  const avisos = await screen.findAllByText(/Frete fixo para o Cariri/);

  expect(avisos.length).toBeGreaterThan(0);
});

test('o menu de categorias reflete o que esta cadastrado', async () => {
  const user = userEvent.setup();

  abrirLoja();

  const botao = await screen.findByRole('button', { name: /Categorias/ });

  expect(botao.getAttribute('aria-expanded')).toBe('false');

  await user.click(botao);

  expect(botao.getAttribute('aria-expanded')).toBe('true');

  // Dentro do cabecalho: os mesmos nomes aparecem no rodape.
  const cabecalho = screen.getByRole('banner');

  // As duas categorias da API, com a subcategoria da primeira.
  expect(await within(cabecalho).findByRole('link', { name: /Masculino/ })).toBeDefined();
  expect(within(cabecalho).getByRole('link', { name: 'Amadeirados' })).toBeDefined();
  expect(within(cabecalho).getByRole('link', { name: /Velas aromaticas/ })).toBeDefined();
});

test('o Escape fecha o painel de categorias', async () => {
  const user = userEvent.setup();

  abrirLoja();

  const botao = await screen.findByRole('button', { name: /Categorias/ });

  await user.click(botao);
  expect(botao.getAttribute('aria-expanded')).toBe('true');

  await user.keyboard('{Escape}');

  expect(botao.getAttribute('aria-expanded')).toBe('false');
});

test('o botao do WhatsApp abre a conversa com o numero configurado', async () => {
  abrirLoja();

  const botao = await screen.findByRole('link', { name: 'Falar com a loja no WhatsApp' });
  const href = botao.getAttribute('href') ?? '';

  expect(href.startsWith('https://wa.me/5588999998888')).toBe(true);
  // A mensagem de abertura ja vai preenchida.
  expect(href).toContain('?text=');
  expect(decodeURIComponent(href)).toContain('Vim pelo site');
});

test('o cabecalho encolhe ao rolar a pagina', async () => {
  abrirLoja();

  const cabecalho = await screen.findByRole('banner');

  expect(cabecalho.className).not.toContain(headerStyles.scrolled);

  Object.defineProperty(window, 'scrollY', { value: 200, writable: true });
  window.dispatchEvent(new Event('scroll'));

  await waitFor(() => {
    expect(cabecalho.className).toContain(headerStyles.scrolled);
  });

  // E volta ao tamanho cheio no topo.
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  window.dispatchEvent(new Event('scroll'));

  await waitFor(() => {
    expect(cabecalho.className).not.toContain(headerStyles.scrolled);
  });
});

test('o rodape monta as colunas com o que a API devolveu', async () => {
  abrirLoja();

  const rodape = await screen.findByRole('contentinfo');

  // `findBy`, e nao `getBy`: o rodape aparece antes de as duas consultas
  // responderem, e e justamente isso que ele deve fazer — a moldura desenha
  // com o que tem, e as colunas se preenchem quando a resposta chega.
  expect(await within(rodape).findByRole('link', { name: 'Quem somos' })).toBeDefined();
  expect(await within(rodape).findByRole('link', { name: /Masculino/ })).toBeDefined();
  expect(within(rodape).getByText('contato@maisonessence.test')).toBeDefined();
  expect(within(rodape).getByText('Seg a sex, 9h as 18h')).toBeDefined();
  // O numero aparece formatado para leitura, sem o codigo do pais.
  expect(within(rodape).getByText('(88) 99999-8888')).toBeDefined();
});

test('as configuracoes sao buscadas uma vez so, mesmo com varios componentes lendo', async () => {
  abrirLoja();

  await screen.findByRole('contentinfo');

  const chamadas = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([url]) => url,
  );

  expect(chamadas.filter((url) => url.includes('/settings'))).toHaveLength(1);
  expect(chamadas.filter((url) => url.includes('/categories'))).toHaveLength(1);
});
