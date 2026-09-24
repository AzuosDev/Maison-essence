// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { StoreSettingsProvider } from '@/features/settings';
import ProductPage from './product-page';
import buyBox from './buy-box.module.css';

/**
 * A pagina do produto contra a API.
 *
 * Os casos aqui sao os criterios de aceite escritos como codigo, e sao
 * justamente os que uma revisao visual nao pega:
 *
 * 1. **Trocar de variante** move quatro coisas ao mesmo tempo — preco, foto,
 *    estoque e endereco. Uma tela que troca o preco e esquece a URL parece
 *    perfeita em tela e manda o link errado para o WhatsApp.
 * 2. **A previa compartilhada** vive em tags do `<head>`, que ninguem ve ao
 *    revisar a pagina: ela so aparece quando o link ja esta na conversa.
 * 3. **A variante esgotada** precisa estar visivel *e* fora de alcance, e a
 *    segunda metade e invisivel numa captura de tela.
 *
 * O Cloudinary entra por `vi.mock` do modulo de ambiente: sem um `cloud
 * name`, o helper de imagem devolve o marcador local e a previa nasceria sem
 * foto — que e um estado de desenvolvimento, e nao o que a loja publica.
 */

vi.mock('@/lib/env', () => ({
  env: {
    VITE_API_URL: 'https://api.maisonessence.test/api/v1',
    VITE_CLOUDINARY_CLOUD_NAME: 'maison',
  },
}));

const CINQUENTA = {
  id: 'v50',
  label: '50ml',
  priceCents: 18990,
  compareAtPriceCents: 25990,
  discountPercent: 27,
  stock: 2,
  isAvailable: true,
  onDemand: false,
  image: 'produtos/asad-50',
};

const CEM = {
  id: 'v100',
  label: '100ml',
  priceCents: 28990,
  compareAtPriceCents: null,
  discountPercent: 0,
  stock: 9,
  isAvailable: true,
  onDemand: false,
  image: 'produtos/asad-100',
};

const DUZENTOS = {
  id: 'v200',
  label: '200ml',
  priceCents: 38990,
  compareAtPriceCents: null,
  discountPercent: 0,
  stock: 0,
  isAvailable: false,
  onDemand: false,
  image: '',
};

const PRODUTO = {
  id: 'p1',
  name: 'Asad',
  slug: 'asad-lattafa',
  brand: 'Lattafa',
  images: ['produtos/asad-50', 'produtos/asad-100'],
  coverImage: 'produtos/asad-50',
  variants: [CINQUENTA, CEM, DUZENTOS],
  hasVariants: true,
  priceRangeCents: { min: 18990, max: 38990 },
  discountPercent: 27,
  inStock: true,
  isFeatured: false,
  isReadyToShip: true,
  tags: [],
  quantityDiscount: { minQty: 3, percentOff: 10 },
  description: 'Amadeirado e especiado, com baunilha no fundo.',
  categories: [{ id: 'c1', name: 'Masculino', slug: 'masculino' }],
  quantityDiscounts: [{ minQty: 3, percentOff: 10 }],
  related: [],
};

const CONFIGURACOES = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: '',
  contactEmail: 'contato@maisonessence.test',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: false,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

const PAGINAS = [{ slug: 'trocas-e-devolucoes', title: 'Trocas e devoluções' }];

const PAGAMENTOS = {
  pix: { keyType: 'phone', hasKey: true, discountPercent: 5 },
  card: {
    maxInstallments: 12,
    interestFreeUpTo: 6,
    monthlyInterestPercent: 1.99,
    minInstallmentCents: 2000,
  },
};

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
      if (url.includes('/products/')) {
        return Promise.resolve(jsonResponse(PRODUTO));
      }

      if (url.includes('/payment-settings')) {
        return Promise.resolve(jsonResponse(PAGAMENTOS));
      }

      if (url.includes('/pages/')) {
        return Promise.resolve(
          jsonResponse({
            slug: 'trocas-e-devolucoes',
            title: 'Trocas e devoluções',
            content: 'Sete dias para devolver.',
          }),
        );
      }

      if (url.includes('/pages')) {
        return Promise.resolve(jsonResponse(PAGINAS));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(CONFIGURACOES));
      }

      if (url.includes('/delivery-cities')) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse(null));
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

/**
 * A pagina montada como a loja a monta, menos a moldura.
 *
 * O roteador e de memoria e comeca no endereco do produto: e ele que da o
 * slug a `useParams` e a query string a `useSearchParams` — sem ele nao ha o
 * que testar no criterio da URL. Devolve o roteador para que o caso consiga
 * ler o endereco depois do clique.
 */
async function abrirProduto(entrada = '/produtos/asad-lattafa') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const router = createMemoryRouter([{ path: '/produtos/:slug', element: <ProductPage /> }], {
    initialEntries: [entrada],
  });

  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <StoreSettingsProvider>
          <RouterProvider router={router} />
        </StoreSettingsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole('heading', { level: 1, name: 'Asad' })).toBeTruthy();

  return router;
}

function fotoPrincipal(): HTMLImageElement {
  const [foto] = screen.getAllByRole('img', { name: /Asad/ });

  return foto as HTMLImageElement;
}

function conteudoDaMeta(seletor: string): string {
  return document.head.querySelector(seletor)?.getAttribute('content') ?? '';
}

function radio(nome: RegExp): HTMLInputElement {
  return screen.getByRole('radio', { name: nome }) as HTMLInputElement;
}

/**
 * O preco em destaque, e nao qualquer "R$ 189,90" da tela.
 *
 * Cada pilula de variante mostra o proprio preco, entao o mesmo valor
 * aparece duas vezes: no seletor e no destaque. Buscar por texto pegaria os
 * dois e o teste passaria mesmo se o destaque nunca mudasse — que e
 * exatamente a falha que este caso existe para pegar.
 */
function precoDestaque(): string {
  return document.querySelector(`.${buyBox.price}`)?.textContent ?? '';
}

test('trocar de variante atualiza preço, foto, estoque e o endereço', async () => {
  const usuario = userEvent.setup();
  const router = await abrirProduto();

  // A pagina abre na mais barata entre as disponiveis, e o aviso de estoque
  // baixo dela aparece junto.
  expect(precoDestaque()).toBe('R$ 189,90');
  expect(screen.getByText('Restam apenas 2 unidades')).toBeTruthy();
  expect(fotoPrincipal().src).toContain('produtos/asad-50');
  expect(router.state.location.search).toBe('');

  await usuario.click(radio(/100ml/));

  await waitFor(() => {
    expect(precoDestaque()).toBe('R$ 289,90');
  });

  // A foto segue a variante, porque os 100ml tem foto propria.
  expect(fotoPrincipal().src).toContain('produtos/asad-100');

  // Estoque de 9 nao e estoque baixo: o aviso da variante anterior sai da
  // tela, em vez de continuar valendo para uma opcao que nao e a escolhida.
  expect(screen.queryByText('Restam apenas 2 unidades')).toBeNull();

  // E o endereco carrega a variante: e o link que vai para a conversa.
  expect(router.state.location.search).toBe('?variante=v100');
});

test('o endereço com variante abre justamente naquela variante', async () => {
  await abrirProduto('/produtos/asad-lattafa?variante=v100');

  expect(precoDestaque()).toBe('R$ 289,90');
  expect(radio(/100ml/).checked).toBe(true);
  expect(fotoPrincipal().src).toContain('produtos/asad-100');
});

test('a variante esgotada aparece na lista e não pode ser escolhida', async () => {
  const usuario = userEvent.setup();
  await abrirProduto();

  // Visivel — quem veio atras dos 200ml precisa saber que eles existem — e
  // anunciada como esgotada a quem ouve a pagina.
  const esgotada = radio(/200ml/);

  expect(esgotada).toBeTruthy();
  expect(screen.getByRole('radio', { name: /200ml.*esgotado/i })).toBeTruthy();

  // E fora de alcance: nem o clique a marca.
  expect(esgotada.disabled).toBe(true);

  await usuario.click(esgotada);

  expect(esgotada.checked).toBe(false);
  expect(radio(/50ml/).checked).toBe(true);
});

test('a prévia compartilhada leva a foto e o preço da variante escolhida', async () => {
  const usuario = userEvent.setup();
  await abrirProduto();

  await waitFor(() => {
    expect(document.title).toBe('Asad — Maison Essence');
  });

  expect(conteudoDaMeta('meta[property="og:title"]')).toBe('Asad — Maison Essence');
  expect(conteudoDaMeta('meta[property="og:type"]')).toBe('product');
  expect(conteudoDaMeta('meta[name="twitter:card"]')).toBe('summary_large_image');

  // A foto da previa e uma URL absoluta do Cloudinary: caminho relativo nao
  // serve para rastreador nenhum.
  const imagem = conteudoDaMeta('meta[property="og:image"]');

  expect(imagem.startsWith('https://res.cloudinary.com/maison/')).toBe(true);
  expect(imagem).toContain('produtos/asad-50');

  await usuario.click(radio(/100ml/));

  await waitFor(() => {
    expect(conteudoDaMeta('meta[property="og:image"]')).toContain('produtos/asad-100');
  });

  // O canonico continua sem o parametro de variante: e o mesmo produto, e
  // dois enderecos indexados dividiriam a relevancia entre si.
  expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
    'http://localhost:3000/produtos/asad-lattafa',
  );
});

test('os dados estruturados descrevem uma oferta por variante', async () => {
  await abrirProduto();

  const script = await waitFor(() => {
    const node = document.head.querySelector('script[type="application/ld+json"]');

    expect(node).toBeTruthy();

    return node as HTMLScriptElement;
  });

  const dados = JSON.parse(script.textContent ?? '{}') as {
    '@type': string;
    brand: { name: string };
    offers: { price: string; availability: string; url: string }[];
  };

  expect(dados['@type']).toBe('Product');
  expect(dados.brand.name).toBe('Lattafa');

  // Preco com ponto decimal e sem simbolo, como a especificacao pede.
  expect(dados.offers.map((offer) => offer.price)).toEqual(['189.90', '289.90', '389.90']);

  // A disponibilidade acompanha o estoque de cada uma, e nao a do produto.
  expect(dados.offers.map((offer) => offer.availability)).toEqual([
    'https://schema.org/InStock',
    'https://schema.org/InStock',
    'https://schema.org/OutOfStock',
  ]);

  // Cada oferta aponta para o endereco que abre justamente ela.
  expect(dados.offers[1]?.url).toContain('?variante=v100');
});

test('a quantidade para no estoque da variante escolhida', async () => {
  const usuario = userEvent.setup();
  await abrirProduto();

  const mais = screen.getByRole('button', { name: 'Aumentar a quantidade' }) as HTMLButtonElement;
  const campo = screen.getByLabelText('Quantidade') as HTMLInputElement;

  await usuario.click(mais);

  expect(campo.value).toBe('2');

  // Duas unidades e todo o estoque dos 50ml: o botao para aqui, em vez de
  // deixar o cliente pedir tres e levar a recusa so no checkout.
  expect(mais.disabled).toBe(true);

  // Trocar de opcao volta a quantidade para um e libera o teto novo.
  await usuario.click(radio(/100ml/));

  await waitFor(() => {
    expect(campo.value).toBe('1');
  });

  expect(mais.disabled).toBe(false);
});

test('a aba de trocas mostra o texto da página institucional', async () => {
  const usuario = userEvent.setup();
  await abrirProduto();

  await usuario.click(await screen.findByRole('tab', { name: 'Trocas e devoluções' }));

  const painel = await screen.findByRole('tabpanel');

  expect(within(painel).getByText('Sete dias para devolver.')).toBeTruthy();
});
