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
 * registro que os critérios de aceite são verificados. Três deles não tem
 * como ser checados de outro jeito:
 *
 * - **Aplicar três filtros e recarregar mantem tudo.** "Recarregar" aqui e
 *   montar a tela com a URL filtrada, que e literalmente o que o navegador
 *   faz — não há estado a restaurar.
 * - **Sem resultados, aparece o estado vazio e não um grid em branco.**
 * - **A página carregada e preservada.** O "carregar mais" empilha, e as
 *   páginas anteriores continuam em tela.
 */

/** Cada `fetch` que a tela fez, na ordem. */
let chamadas: string[];
/** Quantos produtos cada página responde. Um caso pode zerar. */
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
      // também contem `/products`.
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

/** O endereço atual, para verificar o que a tela escreveu na URL. */
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

/** A chamada de listagem — não a das facetas, que pede `limit=48`. */
function listagens(): URLSearchParams[] {
  return chamadas
    .filter((url) => url.includes('/products?') && url.includes('limit=24'))
    .map((url) => new URLSearchParams(url.split('?')[1] ?? ''));
}

/* ---- A URL e o estado --------------------------------------------------- */

test('três filtros na URL chegam aplicados na consulta', async () => {
  // E o critério de "recarregar a página mantem tudo": montar com esta URL e
  // exatamente o que o navegador faz numa recarga.
  abrir('/produtos?marca=Lattafa&min=100&estoque=1');

  await screen.findByRole('heading', { name: 'Asad' });

  const pedido = listagens()[0];

  expect(pedido?.get('brand')).toBe('Lattafa');
  expect(pedido?.get('minPrice')).toBe('10000');
  expect(pedido?.get('inStock')).toBe('true');
});

test('nenhum parâmetro em português vaza para a API', () => {
  // O backend valida com `forbidNonWhitelisted`: um `marca=` no fio não
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

  // A URL e o único estado: e ela que será copiada para o WhatsApp e lida de
  // volta na próxima abertura.
  await waitFor(() => {
    expect(screen.getByTestId('url').textContent).toBe('?estoque=1');
  });
});

test('o contador do botão de filtros acompanha o que esta aplicado', async () => {
  abrir('/produtos?marca=Lattafa&estoque=1');

  expect(await screen.findByRole('button', { name: 'Filtros (2)' })).toBeDefined();
});

/* ---- O vazio ------------------------------------------------------------ */

test('sem resultados, a tela mostra o vazio desenhado e não um grid em branco', async () => {
  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos?marca=Inexistente');

  expect(
    await screen.findByRole('heading', { name: 'Nenhum produto com estes filtros' }),
  ).toBeDefined();

  // E a saída oferecida, que e o que recupera a visita.
  expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDefined();
});

test('limpar filtros devolve o catálogo cheio', async () => {
  const user = userEvent.setup();

  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos?marca=Inexistente&estoque=1');

  await user.click(await screen.findByRole('button', { name: 'Limpar filtros' }));

  await waitFor(() => {
    expect(screen.getByTestId('url').textContent).toBe('');
  });
});

test('sem filtro nenhum, o vazio não oferece um botão que não faria nada', async () => {
  paginas = { 1: [] };
  totalItems = 0;

  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Nenhum produto com estes filtros' });

  expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
});

/* ---- Paginação ---------------------------------------------------------- */

test('carregar mais empilha a página nova sem tirar a anterior', async () => {
  const user = userEvent.setup();

  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Asad' });
  await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

  // O da página 2 aparece e os da 1 continuam: e a "página carregada" que o
  // critério de aceite manda preservar na volta do produto.
  expect(await screen.findByRole('heading', { name: 'Fakhar' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Asad' })).toBeDefined();
  expect(screen.getByTestId('url').textContent).toBe('?pagina=2');
});

test('reabrir na página 2 traz as duas páginas empilhadas', async () => {
  // E o que acontece na volta do produto: a tela remonta com `?pagina=2` e
  // precisa reconstruir a lista inteira, e não só a segunda página.
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

test('a busca manda o termo para a API e o mostra no título', async () => {
  abrir('/busca?q=oud');

  await screen.findByRole('heading', { name: 'Asad' });

  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('oud');
  expect(listagens()[0]?.get('q')).toBe('oud');
});

/* ---- Categoria ---------------------------------------------------------- */

test('a categoria monta o fio de pão, as pílulas e o filtro da rota', async () => {
  abrir('/categorias/amadeirados');

  // O nome vem da árvore do menu, que já esta em cache na loja de verdade.
  const pilulas = await screen.findByRole('navigation', { name: 'Subcategorias' });

  expect(within(pilulas).getByRole('link', { name: /Tudo em Masculino/ })).toBeDefined();
  expect(within(pilulas).getByRole('link', { name: /Amadeirados/ })).toBeDefined();

  const trilha = screen.getByRole('navigation', { name: 'Você esta aqui' });

  expect(within(trilha).getByRole('link', { name: 'Masculino' })).toBeDefined();

  await waitFor(() => {
    expect(listagens()[0]?.get('category')).toBe('amadeirados');
  });
});

/* ---- Prebusca ------------------------------------------------------------ */

test('passar o mouse no card busca o produto antes do clique', async () => {
  const user = userEvent.setup();

  abrir('/produtos');

  // O link do nome, e não o cabeçalho em volta: `mouseenter` não borbulha,
  // e quem carrega a prebusca são os dois links que levam ao produto.
  await user.hover(await screen.findByRole('link', { name: 'Asad' }));

  await waitFor(() => {
    expect(chamadas.some((url) => url.endsWith('/products/asad'))).toBe(true);
  });
});

/* ---- Desktop ------------------------------------------------------------ */

/**
 * O desktop muda mais que a aparência.
 *
 * La a barra de filtros e uma coluna sempre visível — e não uma gaveta — e a
 * paginação e numerada: a página pedida e a única em tela, em vez de empilhar
 * as anteriores. Como isso decide quantas consultas a tela faz, precisa de
 * caso próprio; um `@media` na folha de estilo não seria testável assim.
 *
 * O jsdom não implementa `matchMedia`, então os casos acima rodam no caminho
 * do celular, que e o padrão do `useMediaQuery` quando a API não existe.
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

test('no desktop os filtros ficam na coluna, sem botão de gaveta', async () => {
  noDesktop();

  abrir('/produtos');

  expect(await screen.findByRole('complementary', { name: 'Filtros' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /^Filtros/ })).toBeNull();
});

test('no desktop a paginação e numerada e troca a página em tela', async () => {
  const user = userEvent.setup();

  noDesktop();
  abrir('/produtos');

  await screen.findByRole('heading', { name: 'Asad' });
  await user.click(screen.getByRole('button', { name: 'Página 2' }));

  // A página 2 substitui a 1, em vez de empilhar como no celular.
  expect(await screen.findByRole('heading', { name: 'Fakhar' })).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: 'Asad' })).toBeNull();
  });

  expect(screen.getByTestId('url').textContent).toBe('?pagina=2');
});
