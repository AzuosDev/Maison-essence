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
 * O `fetch` e trocado por um duble que responde as rotas da página. E o que
 * permite verificar o que só se vê com dado de verdade: que o hero mostra o
 * banner cadastrado — o critério de "trocar um banner muda a home sem
 * redeploy" —, que cada uma das três fileiras consome a rota dela, que a
 * fileira vazia cede a vaga para a candidata seguinte, e que as seções que
 * dependem de dado opcional (marcas, cartazes, Instagram, o perfume da vez)
 * desaparecem em vez de desenhar uma caixa vazia.
 */

const BANNERS = [
  {
    id: 'b1',
    imageDesktop: 'banners/verao-desktop',
    imageMobile: 'banners/verao-mobile',
    title: 'Coleção de verão',
    subtitle: 'Notas cítricas para os dias quentes.',
    buttonLabel: 'Ver a coleção',
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

/** As duas tem foto: e o que os cartazes de coleção exigem para existir. */
const CATEGORIES = [
  {
    id: 'c1',
    name: 'Masculino',
    slug: 'masculino',
    image: 'categorias/masculino',
    productCount: 24,
    children: [],
  },
  {
    id: 'c2',
    name: 'Velas',
    slug: 'velas',
    image: 'categorias/velas',
    productCount: 6,
    children: [],
  },
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

/** O que cada rota de prateleira responde. Um caso troca uma entrada antes de montar. */
let prateleiras: Record<string, unknown[]>;

/**
 * O que `GET /products` devolve.
 *
 * Duas prateleiras passam por aqui — promoções (`sort=discount`) e novidades
 * (`sort=newest`) —, e a lista traz de propósito um produto com desconto e um
 * sem: e o que prova que o corte de "só promoções" acontece.
 */
let listagem: unknown[];

/** O produto inteiro de `GET /products/:slug`, com descrição e escada. */
let detalhe: Record<string, unknown>;

let configuracoes: Record<string, unknown>;
let categorias: unknown[];
let chamadas: string[];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  chamadas = [];
  configuracoes = SETTINGS;
  categorias = CATEGORIES;

  prateleiras = {
    featured: [produto('1', 'Asad', { isFeatured: true })],
    'ready-to-ship': [produto('2', 'Yara', { isReadyToShip: true })],
    'best-sellers': [produto('3', 'Fakhar')],
  };

  listagem = [
    produto('4', 'Khamrah', {
      brand: 'Armaf',
      discountPercent: 20,
      variants: [
        {
          id: '4-v1',
          label: '',
          priceCents: 14400,
          compareAtPriceCents: 18000,
          discountPercent: 20,
          stock: 2,
          isAvailable: true,
          onDemand: false,
          image: '',
        },
      ],
      priceRangeCents: { min: 14400, max: 14400 },
    }),
    produto('3', 'Fakhar'),
  ];

  detalhe = {
    ...produto('1', 'Asad', { isFeatured: true }),
    description: 'Notas de açafrão, couro e baunilha. Fixação longa.',
    categories: [],
    quantityDiscounts: [
      { minQty: 3, percentOff: 10 },
      { minQty: 6, percentOff: 15 },
    ],
    related: [],
  };

  // O jsdom não implementa `matchMedia`, e o carrossel o consulta para saber
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

      // A listagem, antes do produto por slug: as duas batem em `/products`, e
      // o que as separa e a query string.
      if (url.includes('/products?') || (url.split('?')[0] ?? '').endsWith('/products')) {
        return Promise.resolve(
          jsonResponse({
            items: listagem,
            page: 1,
            totalPages: 1,
            totalItems: listagem.length,
            hasMore: false,
          }),
        );
      }

      if (url.includes('/products/')) {
        return Promise.resolve(jsonResponse(detalhe));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(configuracoes));
      }

      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse(categorias));
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

/* ---- O hero --------------------------------------------------------------- */

test('o hero mostra o banner cadastrado no painel', async () => {
  abrirHome();

  expect(await screen.findByRole('heading', { name: 'Coleção de verão' })).toBeDefined();
  expect(screen.getByText('Notas cítricas para os dias quentes.')).toBeDefined();
  expect(screen.getByRole('link', { name: 'Ver a coleção' })).toBeDefined();
});

test('a primeira imagem do hero carrega sem lazy e com prioridade', async () => {
  const { container } = abrirHome();

  await screen.findByRole('heading', { name: 'Coleção de verão' });

  const imagens = [...container.querySelectorAll('picture img')];

  expect(imagens[0]?.getAttribute('loading')).toBe('eager');
  expect(imagens[0]?.getAttribute('fetchpriority')).toBe('high');

  // A segunda não disputa banda com a primeira numa conexão lenta.
  expect(imagens[1]?.getAttribute('loading')).toBe('lazy');
});

test('o indicador troca o banner em exibição', async () => {
  const user = userEvent.setup();

  abrirHome();

  const primeiro = await screen.findByRole('heading', { name: 'Coleção de verão' });
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

/* ---- A fileira de categorias --------------------------------------------- */

test('a fileira de categorias leva as categorias principais', async () => {
  abrirHome();

  expect(await screen.findByRole('link', { name: 'Masculino' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Velas' })).toBeDefined();
});

/* ---- As tres fileiras ----------------------------------------------------- */

test('cada prateleira consome a rota dela', async () => {
  abrirHome();

  const maisVendidos = await screen.findByRole('region', { name: 'Mais vendidos' });
  const promocoes = screen.getByRole('region', { name: 'Aproveite as promoções' });
  const compreTambem = screen.getByRole('region', { name: 'Compre também' });

  // `findBy`: a prateleira aparece com os esqueletos e só depois troca pelos
  // produtos — que e exatamente o que o critério de "nenhum salto de layout"
  // pede. Um `getBy` aqui olharia para o esqueleto.
  expect(await within(maisVendidos).findByRole('heading', { name: 'Fakhar' })).toBeDefined();
  expect(await within(promocoes).findByRole('heading', { name: 'Khamrah' })).toBeDefined();
  expect(await within(compreTambem).findByRole('heading', { name: 'Khamrah' })).toBeDefined();

  expect(chamadas.some((url) => url.includes('/products/best-sellers'))).toBe(true);
  expect(chamadas.some((url) => url.includes('sort=discount'))).toBe(true);
  expect(chamadas.some((url) => url.includes('sort=newest'))).toBe(true);
});

/**
 * A do meio empilha, as outras duas rolam.
 *
 * E o ritmo da referência, e ele e por posição e não por prateleira: qual
 * fileira cai na vaga do meio depende do que a loja tem cadastrado. O trilho
 * se reconhece pelo `aria-label` das setas, que a grade não desenha.
 */
test('a fileira do meio e grade, e as outras duas rolam', async () => {
  abrirHome();

  const maisVendidos = await screen.findByRole('region', { name: 'Mais vendidos' });
  const promocoes = screen.getByRole('region', { name: 'Aproveite as promoções' });
  const compreTambem = screen.getByRole('region', { name: 'Compre também' });

  expect(maisVendidos.querySelector('[aria-hidden="true"] button')).not.toBeNull();
  expect(promocoes.querySelector('[aria-hidden="true"] button')).toBeNull();
  expect(compreTambem.querySelector('[aria-hidden="true"] button')).not.toBeNull();
});

/**
 * Tres, e nao quatro.
 *
 * E a decisao da dona, e e o unico numero que a pagina nao negocia: as
 * candidatas sao cinco justamente para que sempre existam tres com produto.
 */
test('a home mostra tres fileiras, mesmo tendo cinco candidatas com produto', async () => {
  abrirHome();

  await screen.findByRole('region', { name: 'Mais vendidos' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'A seleção da casa' })).toBeNull();
  });

  expect(screen.queryByRole('region', { name: 'Pronta entrega' })).toBeNull();
});

test('prateleira sem produto some, e a candidata seguinte assume a vaga', async () => {
  prateleiras['best-sellers'] = [];

  abrirHome();

  // Com "mais vendidos" vazia, a terceira vaga passa a ser da pronta entrega.
  const prontaEntrega = await screen.findByRole('region', { name: 'Pronta entrega' });

  expect(await within(prontaEntrega).findByRole('heading', { name: 'Yara' })).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Mais vendidos' })).toBeNull();
  });
});

/**
 * A rede de seguranca da pagina.
 *
 * Loja recem-cadastrada: nenhum pedido no historico, nenhum desconto, nada
 * marcado como pronta entrega e nenhum destaque. Antes, a home abria no
 * banner e ia direto para o rodape.
 */
test('com as outras quatro candidatas vazias, "compre também" sustenta a vitrine', async () => {
  prateleiras['best-sellers'] = [];
  prateleiras['ready-to-ship'] = [];
  prateleiras.featured = [];

  // Sem nenhum desconto cadastrado, a prateleira de promoções corta tudo e
  // tambem desaparece. Sobra a única que não depende de marcação nenhuma.
  listagem = [produto('3', 'Fakhar')];

  abrirHome();

  const compreTambem = await screen.findByRole('region', { name: 'Compre também' });

  expect(await within(compreTambem).findByRole('heading', { name: 'Fakhar' })).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Aproveite as promoções' })).toBeNull();
  });
});

test('o produto de pronta entrega leva o selo verde na prateleira', async () => {
  // "Pronta entrega" não e mais uma das três fileiras padrão: ela e a quarta
  // candidata, e assume a vaga quando "mais vendidos" não tem o que mostrar.
  prateleiras['best-sellers'] = [];

  abrirHome();

  const prontaEntrega = await screen.findByRole('region', { name: 'Pronta entrega' });

  // O card, e não a seção: o título dela tambem diz "Pronta entrega", e uma
  // busca pelo texto solto dentro da seção acerta os dois.
  const card = await within(prontaEntrega).findByRole('article');

  expect(within(card).getByText('Pronta entrega')).toBeDefined();
});

/**
 * A prateleira de promocoes corta o que veio sem desconto.
 *
 * Nao ha filtro de desconto na API: a vitrine pede a lista ordenada por
 * desconto e corta no cliente. Sem o corte, "Aproveite as promocoes" sairia
 * cheia de produto a preco cheio — a pior mentira que uma loja pode contar
 * numa fileira.
 */
test('as promoções só mostram produto com desconto', async () => {
  abrirHome();

  const promocoes = await screen.findByRole('region', { name: 'Aproveite as promoções' });

  expect(await within(promocoes).findByRole('heading', { name: 'Khamrah' })).toBeDefined();

  // `Fakhar` vem na mesma resposta da listagem, com desconto zero.
  await waitFor(() => {
    expect(within(promocoes).queryByRole('heading', { name: 'Fakhar' })).toBeNull();
  });
});

/* ---- A faixa de marcas ---------------------------------------------------- */

test('a faixa de marcas lista as marcas das fileiras, sem consulta nova', async () => {
  abrirHome();

  const marcas = await screen.findByRole('region', { name: 'Nossas marcas' });

  expect(await within(marcas).findByRole('link', { name: 'Lattafa' })).toBeDefined();
  expect(within(marcas).getByRole('link', { name: 'Armaf' })).toBeDefined();

  // Nenhuma chamada carrega o catalogo inteiro so para descobrir as marcas.
  expect(chamadas.some((url) => url.includes('limit=100'))).toBe(false);
});

test('cada marca leva para a vitrine filtrada por ela', async () => {
  abrirHome();

  const marcas = await screen.findByRole('region', { name: 'Nossas marcas' });
  const lattafa = await within(marcas).findByRole('link', { name: 'Lattafa' });

  expect(lattafa.getAttribute('href')).toBe('/produtos?marca=Lattafa');
});

/* ---- O perfume da vez ----------------------------------------------------- */

test('o perfume da vez e o primeiro destaque, com a descrição do cadastro', async () => {
  abrirHome();

  const bloco = await screen.findByRole('region', { name: 'O perfume da vez' });

  expect(await within(bloco).findByRole('heading', { name: 'Asad' })).toBeDefined();
  expect(within(bloco).getByText(/Notas de açafrão/)).toBeDefined();

  // A descricao so existe em `GET /products/:slug`, e a consulta usa a mesma
  // chave que a pagina do produto vai pedir no clique.
  expect(chamadas.some((url) => url.includes('/products/asad'))).toBe(true);
});

test('a escada de desconto do destaque aparece inteira', async () => {
  abrirHome();

  const bloco = await screen.findByRole('region', { name: 'O perfume da vez' });

  expect(await within(bloco).findByText('Leve 3')).toBeDefined();
  expect(within(bloco).getByText('Leve 6')).toBeDefined();
});

test('sem destaque marcado, o perfume da vez não aparece', async () => {
  prateleiras.featured = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Mais vendidos' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'O perfume da vez' })).toBeNull();
  });
});

/* ---- O Instagram ---------------------------------------------------------- */

test('sem perfil cadastrado, a faixa do Instagram não existe', async () => {
  abrirHome();

  await screen.findByRole('region', { name: 'Mais vendidos' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Acompanhe no Instagram' })).toBeNull();
  });
});

test('o perfil cadastrado vira link, venha como vier', async () => {
  configuracoes = { ...SETTINGS, socialLinks: { instagram: '@maisonessence', tiktok: '' } };

  abrirHome();

  const faixa = await screen.findByRole('region', { name: 'Acompanhe no Instagram' });
  const link = within(faixa).getByRole('link', { name: '@maisonessence' });

  expect(link.getAttribute('href')).toBe('https://instagram.com/maisonessence');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
});

/* ---- Os cartazes de colecao ----------------------------------------------- */

test('os cartazes trazem as duas maiores categorias com foto', async () => {
  abrirHome();

  const colecoes = await screen.findByRole('region', { name: 'Coleções' });
  const links = within(colecoes).getAllByRole('link');

  expect(links).toHaveLength(2);
  expect(links[0]?.getAttribute('href')).toBe('/categorias/masculino');
  expect(links[1]?.getAttribute('href')).toBe('/categorias/velas');
});

test('sem duas categorias com foto, a faixa de cartazes some', async () => {
  categorias = CATEGORIES.map((categoria) => Object.assign({}, categoria, { image: '' }));

  abrirHome();

  await screen.findByRole('region', { name: 'Mais vendidos' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Coleções' })).toBeNull();
  });
});
