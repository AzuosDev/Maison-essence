// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { StoreSettingsProvider } from '@/features/settings';
import shelfStyles from '@/components/store/product-shelf.module.css';
import stripStyles from './category-strip.module.css';
import HomePage from './home-page';

/**
 * A home contra a API.
 *
 * O `fetch` e trocado por um duble que responde as seis rotas da página. E o
 * que permite verificar o que só se vê com dado de verdade: que o hero mostra
 * o banner cadastrado — o critério de "trocar um banner muda a home sem
 * redeploy" —, que cada prateleira consome a rota dela, e que uma prateleira
 * vazia desaparece em vez de anunciar que a loja não tem produto.
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

/**
 * O que `GET /products?brand=...` devolve, por marca.
 *
 * Por marca, e não uma resposta só para `/products`: o que separa as três
 * fileiras de marca e justamente o filtro, e com uma resposta única um erro
 * que fizesse a home pedir a marca errada — ou não pedir marca nenhuma —
 * passaria batido, porque as três apareceriam cheias do mesmo jeito.
 */
let marcas: Record<string, unknown[]>;

/** Marcas cuja consulta responde 500. Vazio, menos onde um caso pede. */
let marcasQuebradas: Set<string>;
let chamadas: string[];

/** A marca pedida numa URL de listagem, ou `null` quando não há filtro. */
function marcaDe(url: string): string | null {
  return new URL(url, 'http://local.test').searchParams.get('brand');
}

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

  marcas = {
    'Isabelle La Belle': [produto('5', 'Body Splash Yara', { brand: 'Isabelle La Belle' })],
    'Arabic Collection': [produto('6', 'Asad 25ml', { brand: 'Arabic Collection' })],
    'Maison Alhambra': [produto('7', 'Body Mist Chants', { brand: 'Maison Alhambra' })],
    Lattafa: [produto('8', 'Desodorante Mayar', { brand: 'Lattafa' })],
  };

  marcasQuebradas = new Set();

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

      // As prateleiras de marca, antes da listagem geral: as duas batem em
      // `/products`, e o que as separa e o filtro.
      const marca = url.includes('/products') ? marcaDe(url) : null;

      if (marca !== null && marcasQuebradas.has(marca)) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'Falhou' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }

      if (marca !== null) {
        return Promise.resolve(
          jsonResponse({
            items: marcas[marca] ?? [],
            page: 1,
            totalPages: 1,
            totalItems: marcas[marca]?.length ?? 0,
          }),
        );
      }

      /*
       * A listagem sem filtro, que nenhuma prateleira da home consome hoje.
       *
       * Fica respondendo vazio, e não removida: e a rota que sustentava
       * "Novidades" antes de ela sair da home, e uma prateleira nova que
       * volte a usar `GET /products` sem filtro precisa ver uma resposta
       * valida aqui em vez de cair no `[]` genérico do fim.
       */
      if (url.includes('/products')) {
        return Promise.resolve(jsonResponse({ items: [], page: 1, totalPages: 1, totalItems: 0 }));
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

  // `findBy`: a prateleira aparece com os esqueletos e só depois troca pelos
  // produtos — que e exatamente o que o critério de "nenhum salto de layout"
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

test('prateleira sem produto some da página', async () => {
  prateleiras['best-sellers'] = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Destaques' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Mais vendidos' })).toBeNull();
  });
});

/* ---- As prateleiras de marca --------------------------------------------- */

test('cada prateleira de marca pede a marca dela, e só ela', async () => {
  abrirHome();

  const isabelle = await screen.findByRole('region', { name: 'Isabelle La Belle' });
  const arabic = await screen.findByRole('region', { name: 'Arabic Collection' });

  expect(await within(isabelle).findByRole('heading', { name: 'Body Splash Yara' })).toBeDefined();
  expect(await within(arabic).findByRole('heading', { name: 'Asad 25ml' })).toBeDefined();

  const pedidas = chamadas.map(marcaDe).filter((marca) => marca !== null);

  expect(pedidas).toContain('Isabelle La Belle');
  expect(pedidas).toContain('Arabic Collection');
});

/**
 * A fileira de duas marcas mostra as duas.
 *
 * E o motivo de as listas serem intercaladas e não emendadas: com a emenda,
 * as cinco vagas sairiam todas da primeira marca assim que ela tivesse cinco
 * produtos, e Lattafa nunca apareceria na prateleira que leva o nome dela.
 */
test('a prateleira combinada traz produto das duas marcas', async () => {
  abrirHome();

  const combinada = await screen.findByRole('region', { name: 'Maison Alhambra e Lattafa' });

  expect(await within(combinada).findByRole('heading', { name: 'Body Mist Chants' })).toBeDefined();
  expect(
    await within(combinada).findByRole('heading', { name: 'Desodorante Mayar' }),
  ).toBeDefined();
});

/**
 * Uma marca fora do ar não leva a prateleira junto.
 *
 * A fileira combinada e duas consultas; se bastasse uma falhar para ela
 * sumir, a loja perderia a seção inteira — e a marca que respondeu bem — sem
 * nenhum aviso.
 */
test('com uma das duas marcas em erro, a prateleira combinada continua', async () => {
  marcasQuebradas.add('Maison Alhambra');

  abrirHome();

  const combinada = await screen.findByRole('region', { name: 'Maison Alhambra e Lattafa' });

  expect(
    await within(combinada).findByRole('heading', { name: 'Desodorante Mayar' }),
  ).toBeDefined();
});

test('marca sem produto nenhum some da home, como as outras prateleiras', async () => {
  marcas['Arabic Collection'] = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Isabelle La Belle' });

  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Arabic Collection' })).toBeNull();
  });
});

/* ---- A ordem das seções -------------------------------------------------- */

/**
 * Os títulos de seção da página, na ordem em que estão no documento.
 *
 * Lê o DOM de uma vez, e não seção por seção com `getByRole`: a lista de
 * prateleiras se refaz quando as consultas respondem — uma que volta vazia
 * some, e o que vem depois dela e remontado —, e uma referência guardada
 * antes disso aponta para um no que já saiu da árvore. Comparar posições
 * entre um no solto e um no vivo não da erro: da uma resposta que o navegador
 * escolhe, e o teste passaria ou falharia por motivo nenhum.
 *
 * Pelos `<h2>`, e não pelas regiões: o hero e uma região também — um
 * carrossel com rótulo —, e uma lista de regiões mistura a moldura da página
 * com o conteúdo dela. O que este teste guarda e a ordem em que o cliente lê
 * os nomes das seções, e essa ordem são os títulos. A assinatura da marca não
 * tem título e por isso não aparece aqui; a posição dela esta garantida por
 * andar dentro de `Collections`.
 */
function ordemDasSecoes(): string[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((titulo) => titulo.textContent?.trim() ?? '');
}

test('as coleções entram depois do bloco de marcas, e não no meio dele', async () => {
  abrirHome();

  await screen.findByRole('region', { name: 'Destaques' });

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual([
      'Isabelle La Belle',
      'Arabic Collection',
      'Maison Alhambra e Lattafa',
      'Descubra as coleções',
      'Destaques',
      'Pronta entrega',
      'Mais vendidos',
    ]);
  });
});

/**
 * A rede de segurança da vitrine.
 *
 * Destaque e pronta entrega saem de marcação no painel, e mais vendidos sai
 * do histórico de pedidos: as três respondem vazio numa loja que acabou de
 * subir o catálogo, que foi o estado em que esta home chegou a produção. As
 * de marca saem do catálogo filtrado — se há produto da marca cadastrado,
 * elas tem o que mostrar, e a home nunca abre sem um perfume na tela.
 *
 * Era o papel de "Novidades", que saiu da home. A troca tem um custo: aquela
 * dependia só de existir produto, e estas dependem de a marca estar escrita
 * no cadastro como esta em `BRANDS`.
 */
test('com as três prateleiras curadas vazias, as marcas sustentam a vitrine', async () => {
  prateleiras['featured'] = [];
  prateleiras['ready-to-ship'] = [];
  prateleiras['best-sellers'] = [];

  abrirHome();

  const isabelle = await screen.findByRole('region', { name: 'Isabelle La Belle' });

  expect(await within(isabelle).findByRole('heading', { name: 'Body Splash Yara' })).toBeDefined();

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual([
      'Isabelle La Belle',
      'Arabic Collection',
      'Maison Alhambra e Lattafa',
      'Descubra as coleções',
    ]);
  });
});

/**
 * A fileira encostada na faixa de coleções sai em areia.
 *
 * A faixa não tem fundo próprio: ela e o creme da página. Uma prateleira em
 * creme logo acima dela encosta sem mudanca de tom, e a vitrine passa a
 * parecer parte da faixa. Foi o que aconteceu quando o bloco de marcas virou
 * a abertura da home e a contagem de tons continuou saindo da primeira
 * prateleira: três antes da faixa em vez de duas, e a terceira caiu em creme.
 */
test('a prateleira que encosta nas coleções sai tingida', async () => {
  abrirHome();

  await screen.findByRole('region', { name: 'Maison Alhambra e Lattafa' });

  await waitFor(() => {
    const ultimaAntesDaFaixa = screen.getByRole('region', { name: 'Maison Alhambra e Lattafa' });

    expect(ultimaAntesDaFaixa.className).toContain(shelfStyles.tinted);
  });
});

/** E a de cima dela, não: duas de areia seguidas leem como uma fileira só. */
test('a prateleira anterior a essa não sai tingida', async () => {
  abrirHome();

  await screen.findByRole('region', { name: 'Arabic Collection' });

  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Arabic Collection' }).className).not.toContain(
      shelfStyles.tinted,
    );
  });
});

test('sem destaques, o bloco de marcas continua abrindo a página', async () => {
  prateleiras['featured'] = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Pronta entrega' });

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual([
      'Isabelle La Belle',
      'Arabic Collection',
      'Maison Alhambra e Lattafa',
      'Descubra as coleções',
      'Pronta entrega',
      'Mais vendidos',
    ]);
  });
});

/**
 * A regressão que motivou o arranjo dinâmico.
 *
 * Com as posições escritas a mão, uma prateleira que sai vazia empurra a
 * faixa de coleções para cima e ela aparece antes do que deveria — foi assim
 * que uma loja sem destaque marcado chegou a abrir no banner e ir direto para
 * uma tela de navegação, sem um perfume no meio.
 *
 * Agora quem abre a página são as três de marca, então o caso a guardar e uma
 * delas vazia: a faixa não pode subir para o meio do bloco, tem de continuar
 * entrando depois da terceira fileira que de fato aparecer.
 */
test('com uma marca vazia, as coleções ainda esperam três prateleiras', async () => {
  marcas['Arabic Collection'] = [];

  abrirHome();

  await screen.findByRole('region', { name: 'Isabelle La Belle' });

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual([
      'Isabelle La Belle',
      'Maison Alhambra e Lattafa',
      'Destaques',
      'Descubra as coleções',
      'Pronta entrega',
      'Mais vendidos',
    ]);
  });
});

test('com uma prateleira só, as coleções vem logo depois dela', async () => {
  prateleiras['featured'] = [];
  prateleiras['best-sellers'] = [];
  marcas = {};

  abrirHome();

  await screen.findByRole('region', { name: 'Pronta entrega' });

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual(['Pronta entrega', 'Descubra as coleções']);
  });
});

/**
 * Sem prateleira nenhuma, quem encosta no banner são as coleções.
 *
 * O respiro de cima existe para separar duas seções de mesmo tom; contra a
 * foto escura do banner ele só empurra o conteúdo para fora da primeira tela.
 * Quem recebe esse tratamento e a primeira seção que sobrou, seja ela qual
 * for — por isso o teste olha a faixa, e não a prateleira.
 */
test('sem prateleira nenhuma, as coleções encostam no banner', async () => {
  prateleiras['featured'] = [];
  prateleiras['ready-to-ship'] = [];
  prateleiras['best-sellers'] = [];
  marcas = {};

  abrirHome();

  await screen.findByRole('region', { name: 'Descubra as coleções' });

  await waitFor(() => {
    expect(ordemDasSecoes()).toEqual(['Descubra as coleções']);
    expect(screen.getByRole('region', { name: 'Descubra as coleções' }).className).toContain(
      stripStyles.flush,
    );
  });
});
