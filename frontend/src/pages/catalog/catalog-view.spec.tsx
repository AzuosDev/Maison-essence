// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import CategoryPage from './category-page';
import ProductsPage from './products-page';
import SearchPage from './search-page';

/**
 * A listagem contra a API.
 *
 * O `fetch` e trocado por um duble que registra cada chamada, e e sobre esse
 * registro que os criterios de aceite sao verificados. Tres deles nao tem
 * como ser checados de outro jeito:
 *
 * - **Aplicar tres filtros e recarregar mantem tudo.** "Recarregar" aqui e
 *   montar a tela com a URL filtrada, que e literalmente o que o navegador
 *   faz — nao ha estado a restaurar.
 * - **Sem resultados, aparece o estado vazio e nao um grid em branco.**
 * - **A pagina carregada e preservada.** O "carregar mais" empilha, e as
 *   paginas anteriores continuam em tela.
 */

/** Cada `fetch` que a tela fez, na ordem. */
let chamadas: string[];
/** Quantos produtos cada pagina responde. Um caso pode zerar. */
let paginas: Record<number, string[]>;
let totalItems: number;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function produto(nome: string) {
  const slug = nome.toLowerCase().replace(/\s+/g, '-');

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

const CATEGORIAS = [
  {
    id: 'c1',
    name: 'Masculino',
    slug: 'masculino',
    image: '',
    productCount: 24,
    children: [{ id: 'c2', name: 'Amadeirados', slug: 'amadeirados', image: '', productCount: 8 }],
  },
];

beforeEach(() => {
  chamadas = [];
  totalItems = 3;
  paginas = { 1: ['Asad', 'Yara'], 2: ['Fakhar'] };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(url);

      const query = new URLSearchParams(url.split('?')[1] ?? '');

      // As rotas de nome fixo vem antes da listagem: `/products/best-sellers`
      // tambem contem `/products`.
      if (url.includes('/products/best-sellers')) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes('/payment-settings')) {
        return Promise.resolve(jsonResponse({ pix: null, card: null }));
      }

      if (url.includes('/categories/')) {
        return Promise.resolve(jsonResponse(CATEGORIAS[0]));
      }

      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse(CATEGORIAS));
      }

      const page = Number(query.get('page') ?? '1');
      const items = (paginas[page] ?? []).map(produto);

      return Promise.resolve(
        jsonResponse({
          items,
          page,
          totalPages: Object.keys(paginas).length,
          totalItems,
          hasMore: page < Object.keys(paginas).length,
        }),
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** O endereco atual, para verificar o que a tela escreveu na URL. */
function Endereco() {
  const { search } = useLocation();

  return <output data-testid="url">{search}</output>;
}

function abrir(rota: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Endereco />

          <Routes>
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/categorias/:slug" element={<CategoryPage />} />
            <Route path="/busca" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** A chamada de listagem — nao a das facetas, que pede `limit=48`. */
function listagens(): URLSearchParams[] {
  return chamadas
    .filter((url) => url.includes('/products?') && url.includes('limit=24'))
    .map((url) => new URLSearchParams(url.split('?')[1] ?? ''));
}

/* ---- A URL e o estado --------------------------------------------------- */

test('tres filtros na URL chegam aplicados na consulta', async () => {
  // E o criterio de "recarregar a pagina mantem tudo": montar com esta URL e
  // exatamente o que o navegador faz numa recarga.
  abrir('/produtos?marca=Lattafa&min=100&estoque=1');

  await screen.findByRole('heading', { name: 'Asad' });

  const pedido = listagens()[0];

  expect(pedido?.get('brand')).toBe('Lattafa');
  expect(pedido?.get('minPrice')).toBe('10000');
  expect(pedido?.get('inStock')).toBe('true');
});

test('nenhum parametro em portugues vaza para a API', () => {
  // O backend valida com `forbidNonWhitelisted`: um `marca=` no fio nao
  // seria ignorado, seria um 400 e uma vitrine vazia.
  abrir('/produtos?marca=Lattafa&min=100&estoque=1&desconto=1&ordem=nome&pagina=2');

  for (const pedido of listagens()) {
    for (const chave of ['marca', 'min', 'max', 'estoque', 'pronta', 'desconto', 'ordem']) {
      expect(pedido.has(chave)).toBe(false);
    }
  }
});

test('marcar um filtro escreve na URL', async () => {
  const user = userEvent.setup();

  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Asad' });
  await user.click(await screen.findByRole('button', { name: /^Filtros/ }));
  await user.click(await screen.findByLabelText('Somente em estoque'));

  // A URL e o unico estado: e ela que sera copiada para o WhatsApp e lida de
  // volta na proxima abertura.
  await waitFor(() => {
    expect(screen.getByTestId('url').textContent).toBe('?estoque=1');
  });
});

test('o contador do botao de filtros acompanha o que esta aplicado', async () => {
  abrir('/produtos?marca=Lattafa&estoque=1');

  expect(await screen.findByRole('button', { name: 'Filtros (2)' })).toBeDefined();
});

/* ---- O vazio ------------------------------------------------------------ */

test('sem resultados, a tela mostra o vazio desenhado e nao um grid em branco', async () => {
  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos?marca=Inexistente');

  expect(
    await screen.findByRole('heading', { name: 'Nenhum produto com estes filtros' }),
  ).toBeDefined();

  // E a saida oferecida, que e o que recupera a visita.
  expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDefined();
});

test('limpar filtros devolve o catalogo cheio', async () => {
  const user = userEvent.setup();

  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos?marca=Inexistente&estoque=1');

  await user.click(await screen.findByRole('button', { name: 'Limpar filtros' }));

  await waitFor(() => {
    expect(screen.getByTestId('url').textContent).toBe('');
  });
});

test('sem filtro nenhum, o vazio nao oferece um botao que nao faria nada', async () => {
  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Nenhum produto com estes filtros' });

  expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
});

/* ---- Paginacao ---------------------------------------------------------- */

test('carregar mais empilha a pagina nova sem tirar a anterior', async () => {
  const user = userEvent.setup();

  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Asad' });
  await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

  // O da pagina 2 aparece e os da 1 continuam: e a "pagina carregada" que o
  // criterio de aceite manda preservar na volta do produto.
  expect(await screen.findByRole('heading', { name: 'Fakhar' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Asad' })).toBeDefined();
  expect(screen.getByTestId('url').textContent).toBe('?pagina=2');
});

test('reabrir na pagina 2 traz as duas paginas empilhadas', async () => {
  // E o que acontece na volta do produto: a tela remonta com `?pagina=2` e
  // precisa reconstruir a lista inteira, e nao so a segunda pagina.
  abrir('/produtos?pagina=2');

  expect(await screen.findByRole('heading', { name: 'Asad' })).toBeDefined();
  expect(await screen.findByRole('heading', { name: 'Fakhar' })).toBeDefined();
});

/* ---- A busca ------------------------------------------------------------ */

test('a busca realca o termo no nome do produto', async () => {
  paginas = { 1: ['Asad Lattafa'] };

  abrir('/busca?q=asad');

  const nome = await screen.findByRole('heading', { name: 'Asad Lattafa' });

  expect(within(nome).getByText('Asad').tagName).toBe('MARK');
});

test('a busca manda o termo para a API e o mostra no titulo', async () => {
  abrir('/busca?q=oud');

  await screen.findByRole('heading', { name: 'Asad' });

  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('oud');
  expect(listagens()[0]?.get('q')).toBe('oud');
});

/* ---- Categoria ---------------------------------------------------------- */

test('a categoria monta o fio de pao, as pilulas e o filtro da rota', async () => {
  abrir('/categorias/amadeirados');

  // O nome vem da arvore do menu, que ja esta em cache na loja de verdade.
  const pilulas = await screen.findByRole('navigation', { name: 'Subcategorias' });

  expect(within(pilulas).getByRole('link', { name: /Tudo em Masculino/ })).toBeDefined();
  expect(within(pilulas).getByRole('link', { name: /Amadeirados/ })).toBeDefined();

  const trilha = screen.getByRole('navigation', { name: 'Voce esta aqui' });

  expect(within(trilha).getByRole('link', { name: 'Masculino' })).toBeDefined();

  await waitFor(() => {
    expect(listagens()[0]?.get('category')).toBe('amadeirados');
  });
});

/* ---- Prebusca ------------------------------------------------------------ */

test('passar o mouse no card busca o produto antes do clique', async () => {
  const user = userEvent.setup();

  abrir('/produtos');

  // O link do nome, e nao o cabecalho em volta: `mouseenter` nao borbulha,
  // e quem carrega a prebusca sao os dois links que levam ao produto.
  await user.hover(await screen.findByRole('link', { name: 'Asad' }));

  await waitFor(() => {
    expect(chamadas.some((url) => url.endsWith('/products/asad'))).toBe(true);
  });
});

/* ---- Desktop ------------------------------------------------------------ */

/**
 * O desktop muda mais que a aparencia.
 *
 * La a barra de filtros e uma coluna sempre visivel — e nao uma gaveta — e a
 * paginacao e numerada: a pagina pedida e a unica em tela, em vez de empilhar
 * as anteriores. Como isso decide quantas consultas a tela faz, precisa de
 * caso proprio; um `@media` na folha de estilo nao seria testavel assim.
 *
 * O jsdom nao implementa `matchMedia`, entao os casos acima rodam no caminho
 * do celular, que e o padrao do `useMediaQuery` quando a API nao existe.
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

test('no desktop os filtros ficam na coluna, sem botao de gaveta', async () => {
  noDesktop();

  abrir('/produtos');

  expect(await screen.findByRole('complementary', { name: 'Filtros' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /^Filtros/ })).toBeNull();
});

test('no desktop a paginacao e numerada e troca a pagina em tela', async () => {
  const user = userEvent.setup();

  noDesktop();
  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Asad' });
  await user.click(screen.getByRole('button', { name: 'Pagina 2' }));

  // A pagina 2 substitui a 1, em vez de empilhar como no celular.
  expect(await screen.findByRole('heading', { name: 'Fakhar' })).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: 'Asad' })).toBeNull();
  });

  expect(screen.getByTestId('url').textContent).toBe('?pagina=2');
});
