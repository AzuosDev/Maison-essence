// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
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
  { slug: 'trocas-e-devolucoes', title: 'Trocas e devoluções' },
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

/**
 * A moldura monta num roteador de dados, e nao num `<MemoryRouter>`.
 *
 * O layout da loja traz o `<ScrollRestoration>`, que e um componente das
 * APIs de dados do React Router e exige um roteador criado por
 * `createMemoryRouter` ou `createBrowserRouter` — que e o que a aplicacao de
 * verdade usa. Com o roteador declarativo antigo, ele lanca na montagem.
 */
function abrirLoja() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        element: <StoreLayout />,
        children: [{ index: true, element: <p>Vitrine</p> }],
      },
    ],
    { initialEntries: ['/'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/**
 * Monta a moldura na largura do desktop.
 *
 * O jsdom nao implementa `matchMedia`, e sem ele o `useMediaQuery` responde
 * `false` — o caminho do celular. La o rodape e um acordeao: as quatro
 * colunas viram botoes fechados, e um deles se chama "Categorias", que e
 * tambem o nome do botao do menu no cabecalho. Os casos que falam do painel
 * do cabecalho e das colunas do rodape pedem, os dois, a forma do desktop.
 */
function noDesktop(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
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

  noDesktop();
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

  noDesktop();
  abrirLoja();

  const botao = await screen.findByRole('button', { name: /Categorias/ });

  await user.click(botao);
  expect(botao.getAttribute('aria-expanded')).toBe('true');

  await user.keyboard('{Escape}');

  expect(botao.getAttribute('aria-expanded')).toBe('false');
});

test('o botão do WhatsApp abre a conversa com o número configurado', async () => {
  abrirLoja();

  const botao = await screen.findByRole('link', { name: 'Falar com a loja no WhatsApp' });
  const href = botao.getAttribute('href') ?? '';

  expect(href.startsWith('https://wa.me/5588999998888')).toBe(true);
  // A mensagem de abertura ja vai preenchida.
  expect(href).toContain('?text=');
  expect(decodeURIComponent(href)).toContain('Vim pelo site');
});

test('o cabeçalho encolhe ao rolar a página', async () => {
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

test('o rodapé monta as colunas com o que a API devolveu', async () => {
  noDesktop();
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

/**
 * No celular o rodape e um indice, nao um segundo documento.
 *
 * Quatro listas abertas somavam mais de 800px logo abaixo da vitrine. O caso
 * guarda as duas metades do contrato: fechada, a lista nao esta na arvore
 * acessivel — e `hidden`, e nao apenas escondida por CSS, que um leitor de
 * tela anunciaria assim mesmo; aberta, esta.
 */
test('no celular as colunas do rodapé começam fechadas e abrem no toque', async () => {
  const user = userEvent.setup();

  abrirLoja();

  const rodape = await screen.findByRole('contentinfo');
  const institucional = await within(rodape).findByRole('button', { name: 'Institucional' });

  expect(institucional.getAttribute('aria-expanded')).toBe('false');
  expect(within(rodape).queryByRole('link', { name: 'Quem somos' })).toBeNull();

  await user.click(institucional);

  expect(institucional.getAttribute('aria-expanded')).toBe('true');
  expect(await within(rodape).findByRole('link', { name: 'Quem somos' })).toBeDefined();
});

test('as configurações são buscadas uma vez só, mesmo com vários componentes lendo', async () => {
  abrirLoja();

  await screen.findByRole('contentinfo');

  const chamadas = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([url]) => url,
  );

  expect(chamadas.filter((url) => url.includes('/settings'))).toHaveLength(1);
  expect(chamadas.filter((url) => url.includes('/categories'))).toHaveLength(1);
});
