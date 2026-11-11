// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminSettingsPage from './admin-settings-page';

/**
 * A tela de configurações.
 *
 * O que estes casos cobram:
 *
 * - **abrir a tela não a deixa suja**, que e o risco próprio desta tela: os
 *   banners viajam como instante e são editados como dia, e um arredondamento
 *   a mais faria a barra de salvar aparecer sozinha a cada abertura;
 * - **só o que mudou viaja**, e o endereço campo a campo — corrigir o número
 *   da casa não pode apagar o ponto de referência;
 * - **o que some do site sem avisar vira aviso escrito**;
 * - **a divisão por campo**: o gerente da loja abre a tela e grava o que muda
 *   no expediente — a vitrine da home entre as coisas: atalhos, mais
 *   vendidos, marcas, perfume da vez e redes sociais. Só as três seções de
 *   moldura — carrossel, cartazes de coleção e páginas do rodapé — não são
 *   desenhadas para ele. O atendimento não entra de jeito nenhum.
 */

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999999999',
  announcementText: 'Frete grátis acima de R$ 200',
  contactEmail: 'contato@maisonessence.test',
  businessHours: 'Seg a Sex, 9h as 18h',
  pickupEnabled: true,
  pickupAddress: {
    street: 'Rua das Flores',
    number: '120',
    complement: '',
    district: 'Centro',
    city: 'Sobral',
    state: 'CE',
    zipCode: '62010-000',
    reference: 'Em frente a praça',
  },
  pickupInstructions: 'Toque a campainha.',
  socialLinks: { instagram: '@maisonessence', tiktok: '' },
  freeShippingMinCents: 20_000,
  featuredPerfumeProductId: null,
  // A fileira de mais vendidos no automatico, como a loja nasce.
  bestSellerProductIds: [] as string[],
  gift: { isActive: false, minCents: null, productId: null, label: '' },
  banners: [
    {
      id: 'b1',
      imageDesktop: 'banners/verao',
      imageMobile: 'banners/verao-mobile',
      title: 'Coleção de verão',
      subtitle: 'Notas cítricas',
      buttonLabel: 'Ver a coleção',
      link: '/produtos',
      placement: 'hero',
      order: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
    },
    {
      id: 'b2',
      imageDesktop: 'banners/natal',
      imageMobile: 'banners/natal-mobile',
      title: 'Natal',
      subtitle: '',
      buttonLabel: '',
      link: '',
      placement: 'hero',
      order: 1,
      // Agendado para o passado: o banner já saiu do ar sozinho.
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-01-31T23:59:59.999Z',
      isActive: true,
    },
  ],
  // A faixa de cartazes e a de marcas no automatico, como a loja nasce.
  posters: [] as {
    id: string;
    label: string;
    image: string;
    link: string;
    caption: string;
    order: number;
    isActive: boolean;
  }[],
  brands: [] as string[],
  shortcuts: [
    {
      id: 's1',
      label: 'Hidratantes',
      image: 'shortcuts/hidratantes',
      link: '/categorias/hidratantes',
      order: 0,
      isActive: true,
    },
  ],
  institutionalPages: [
    { slug: 'quem-somos', title: 'Quem somos', content: 'Perfumes árabes.', isActive: true },
    { slug: 'como-comprar', title: 'Como comprar', content: '', isActive: false },
    { slug: 'trocas-e-devolucoes', title: 'Trocas e devoluções', content: '', isActive: false },
    { slug: 'perguntas-frequentes', title: 'Perguntas frequentes', content: '', isActive: false },
    {
      slug: 'politica-de-privacidade',
      title: 'Política de privacidade',
      content: '',
      isActive: false,
    },
  ],
  updatedAt: '2026-09-01T12:00:00.000Z',
};

/**
 * O catálogo que a busca do "perfume da vez" encontra.
 *
 * Dois produtos e o bastante: um para escolher e outro para provar que a
 * lista não escolhe sozinha.
 */
const PRODUCTS = [
  {
    id: 'p1',
    name: 'Asad Lattafa',
    slug: 'asad-lattafa',
    description: '',
    brand: 'Lattafa',
    categoryIds: [],
    images: ['produtos/asad'],
    coverImage: 'produtos/asad',
    variants: [],
    hasVariants: false,
    priceRangeCents: { min: 19_990, max: 19_990 },
    discountPercent: 0,
    inStock: true,
    totalStock: 5,
    isActive: true,
    isFeatured: true,
    isReadyToShip: true,
    tags: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'p2',
    name: 'Yara Lattafa',
    slug: 'yara-lattafa',
    description: '',
    brand: 'Lattafa',
    categoryIds: [],
    images: ['produtos/yara'],
    coverImage: 'produtos/yara',
    variants: [],
    hasVariants: false,
    priceRangeCents: { min: 17_990, max: 17_990 },
    discountPercent: 0,
    inStock: true,
    totalStock: 2,
    isActive: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  },
];

let calls: { url: string; method: string; body: string }[] = [];

type Settings = typeof SETTINGS;
type Patch = Partial<Settings>;

/**
 * O documento como o servidor o devolve depois do `PATCH`.
 *
 * Os três comportamentos do backend estão aqui de propósito, e não um
 * `{ ...SETTINGS, ...patch }`: o endereço e as redes **fundem** campo a
 * campo, as páginas são casadas por `slug`, e só os banners substituem o
 * array inteiro. Uma resposta parcial seria uma resposta que o servidor nunca
 * manda — e o teste passaria a cobrar da tela uma defesa que não precisa
 * existir.
 */
function saved(patch: Patch): Settings {
  return {
    ...SETTINGS,
    ...patch,
    pickupAddress: { ...SETTINGS.pickupAddress, ...patch.pickupAddress },
    socialLinks: { ...SETTINGS.socialLinks, ...patch.socialLinks },
    banners: patch.banners ?? SETTINGS.banners,
    bestSellerProductIds: patch.bestSellerProductIds ?? SETTINGS.bestSellerProductIds,
    posters: patch.posters ?? SETTINGS.posters,
    brands: patch.brands ?? SETTINGS.brands,
    institutionalPages: SETTINGS.institutionalPages.map((page) =>
      mergePage(page, patch.institutionalPages),
    ),
  };
}

function mergePage(
  page: Settings['institutionalPages'][number],
  updates: Settings['institutionalPages'] | undefined,
): Settings['institutionalPages'][number] {
  const update = updates?.find((incoming) => incoming.slug === page.slug);

  return update === undefined ? page : { ...page, ...update };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * As grafias de marca do cadastro, como o servidor as conta.
 *
 * As duas primeiras são a mesma casa escrita de dois jeitos — uma letra de
 * diferença —, que e o caso que a seção de marcas existe para mostrar.
 */
const BRANDS = [
  { name: 'Isabele La Belle', products: 1, live: 1 },
  { name: 'Isabelle La Belle', products: 6, live: 5 },
  { name: 'Lattafa', products: 4, live: 0 },
];

/** A arvore que o seletor de destino de um atalho oferece. */
const CATEGORIES = [
  {
    id: 'c1',
    name: 'Hidratantes',
    slug: 'hidratantes',
    previousSlugs: [],
    parentId: null,
    image: '',
    order: 0,
    isActive: true,
    productCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    children: [],
  },
];

beforeEach(() => {
  calls = [];

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : '' });

      if (method === 'GET') {
        // A busca do perfume da vez bate em `/admin/products`, e não nas
        // configurações: sem este desvio, a tela receberia o documento da loja
        // no lugar de uma página de produtos.
        // A faixa de marcas pede as grafias do cadastro, com a contagem de
        // cada uma. Sem este desvio ela receberia a pagina de produtos e a
        // lista de escolha viria vazia.
        if (url.includes('/admin/products/brands')) {
          return Promise.resolve(jsonResponse(BRANDS));
        }

        if (url.includes('/admin/products')) {
          // Cada linha da fileira de mais vendidos pede o produto pelo id, e
          // não a pagina: sem este desvio ela receberia a lista inteira e
          // mostraria uma linha sem nome.
          const chosen = PRODUCTS.find((product) => url.endsWith(`/${product.id}`));

          if (chosen !== undefined) {
            return Promise.resolve(jsonResponse(chosen));
          }

          return Promise.resolve(
            jsonResponse({
              items: PRODUCTS,
              page: 1,
              totalPages: 1,
              totalItems: PRODUCTS.length,
              hasMore: false,
            }),
          );
        }

        // O seletor de destino dos atalhos pede a arvore de categorias.
        // Sem este desvio ele receberia o documento da loja no lugar da
        // lista, e a seção inteira cairia ao desenhar as opções.
        if (url.includes('/admin/categories')) {
          return Promise.resolve(jsonResponse(CATEGORIES));
        }

        return Promise.resolve(jsonResponse(SETTINGS));
      }

      const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Patch;

      return Promise.resolve(jsonResponse(saved(patch)));
    }),
  );
});

afterEach(() => {
  cleanup();
  useAdminSession.getState().signOut();
  vi.unstubAllGlobals();
});

function signInAs(role: UserRole): void {
  const user: AdminUser = {
    id: 'u1',
    name: 'Rayane Souza',
    email: 'rayane@maisonessence.test',
    role,
    isActive: true,
    mustChangePassword: false,
    credentialVersion: 1,
    lastLoginAt: null,
  };

  useAdminSession.getState().signIn(user, { accessToken: 'token', refreshToken: 'refresh' });
}

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [{ path: '/admin/configuracoes', Component: AdminSettingsPage }],
    { initialEntries: ['/admin/configuracoes'] },
  );

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function lastWrite(): { url: string; method: string; body: string } | undefined {
  return calls.findLast((call) => call.method !== 'GET');
}

/**
 * Entra num assunto da grade.
 *
 * A tela mostra um assunto por vez: a grade de retângulos primeiro, e o
 * formulário só depois do clique. Quase todo caso daqui mexe em um assunto, e e
 * por isso que ele começa com `abrir()` e este clique.
 */
async function entrar(assunto: string, user = userEvent.setup()): Promise<void> {
  // O nome acessível do retângulo e o título mais o resumo mais o estado atual;
  // a âncora no começo e o que separa "Atalhos da home" de "Banners da home".
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${assunto}`) }));
}

/* ---- Abrir a tela ------------------------------------------------------------ */

test('abre com o que esta gravado, e o número legível', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja');

  const whatsapp = screen.getByRole('textbox', { name: 'WhatsApp' });

  expect((whatsapp as HTMLInputElement).value).toBe('(88) 99999-9999');
  expect((screen.getByRole('textbox', { name: 'Nome da loja' }) as HTMLInputElement).value).toBe(
    'Maison Essence',
  );
});

test('abrir a tela não a deixa suja, nem com banner agendado', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  // A grade carregada — e com ela o rascunho que o banner agendado alimenta.
  await screen.findByRole('button', { name: /^Banners da home/ });

  // O banner viaja como instante e e editado como dia. Se a volta não fosse
  // exata, a barra apareceria sozinha e a dona aprenderia a ignora-lá.
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

test('o STAFF não entra: o destino do pedido não e coisa de atendimento', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

test('o gerente entra e grava a operação da loja', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  // Os quatro assuntos que são dele, na grade.
  expect(await screen.findByRole('button', { name: /^A loja/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Retirada na loja/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^O brinde/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Atalhos da home/ })).toBeDefined();

  // E, abrindo o primeiro, os campos que ele guarda.
  await entrar('A loja');

  expect(screen.getByLabelText(/Nome da loja/)).toBeDefined();
  expect(screen.getByLabelText(/Barra de avisos/)).toBeDefined();
  expect(screen.getByLabelText(/Horário de atendimento/)).toBeDefined();
});

test('para o gerente, só a moldura da loja não e desenhada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('button', { name: /^A loja/ });

  // Nem desabilitados: fora da grade. Retângulo cinza que não abre e um convite
  // a perguntar "por que não posso?" no meio do expediente.
  expect(screen.queryByRole('button', { name: /^Banners da home/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cartazes de coleção/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Páginas do rodapé/ })).toBeNull();

  // E a vitrine da home, que e do expediente, continua na grade dele.
  expect(screen.getByRole('button', { name: /^Atalhos da home/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Mais vendidos/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Nossas marcas/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^O perfume da vez/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Redes sociais/ })).toBeDefined();

  // E no lugar das três, a linha que diz onde aquilo foi e a quem pedir.
  expect(screen.getByText(/ficam com quem mantem o sistema/)).toBeDefined();
});

test('o administrador vê os onze assuntos', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  expect(await screen.findByRole('button', { name: /^A loja/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Retirada na loja/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^O brinde/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Banners da home/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Atalhos da home/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Mais vendidos/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Nossas marcas/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Cartazes de coleção/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^O perfume da vez/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Redes sociais/ })).toBeDefined();
  expect(screen.getByRole('button', { name: /^Páginas do rodapé/ })).toBeDefined();
  expect(screen.queryByText(/ficam com quem mantem o sistema/)).toBeNull();
});

/* ---- A grade de assuntos ------------------------------------------------------- */

/**
 * O estado atual fica no retângulo, e e o que responde "como esta a loja?".
 *
 * Sem ele a grade seria um índice: onze nomes que obrigam a abrir cada um para
 * descobrir se a retirada esta ligada. Sai do rascunho, e não do que esta
 * gravado, para concordar com o que a pessoa acabou de digitar lá dentro.
 */
test('o retângulo diz como o assunto esta, sem precisar abrir', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  const loja = await screen.findByRole('button', { name: /^A loja/ });

  expect(within(loja).getByText('Maison Essence')).toBeDefined();
  expect(
    within(screen.getByRole('button', { name: /^Retirada na loja/ })).getByText('oferecendo'),
  ).toBeDefined();
  expect(
    within(screen.getByRole('button', { name: /^Mais vendidos/ })).getByText('no automático'),
  ).toBeDefined();
  // A loja de mentira tem cinco páginas, e só "Quem somos" publicada.
  expect(
    within(screen.getByRole('button', { name: /^Páginas do rodapé/ })).getByText(
      '1 de 5 publicadas',
    ),
  ).toBeDefined();
});

/**
 * A volta para a grade não grava, e não descarta.
 *
 * E a promessa que separa esta tela de nove telas de verdade: o rascunho e um
 * só, a barra de gravar e uma só, e quem mexeu em dois assuntos grava os dois
 * num clique.
 */
test('o que foi digitado atravessa a volta para a grade', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);

  const nome = screen.getByRole('textbox', { name: 'Nome da loja' });

  await user.clear(nome);
  await user.type(nome, 'Maison Essence Perfumes');
  await user.click(screen.getByRole('button', { name: 'Todos os assuntos' }));

  // Na grade, o retângulo já mostra o nome novo — e a barra continua de pé.
  expect(
    within(await screen.findByRole('button', { name: /^A loja/ })).getByText(
      'Maison Essence Perfumes',
    ),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDefined();

  await entrar('A loja', user);

  expect((screen.getByRole('textbox', { name: 'Nome da loja' }) as HTMLInputElement).value).toBe(
    'Maison Essence Perfumes',
  );
});

/**
 * Gravar com erro num assunto fechado abre o assunto, e diz qual e.
 *
 * Sem isso "Salvar" não faria nada e a tela não teria dito por que: o campo que
 * recusa a gravação estaria atras de um clique que ninguém sabe que precisa dar.
 */
test('gravar com campo invalido abre o assunto dele, e nada viaja', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);
  await user.clear(screen.getByRole('textbox', { name: 'Nome da loja' }));
  await user.click(screen.getByRole('button', { name: 'Todos os assuntos' }));
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/Há campo para corrigir em/)).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Nome da loja' })).toBeDefined();
  expect(lastWrite()).toBeUndefined();
});

/**
 * O retângulo leva a marca do que esta escondido nele.
 *
 * Ponto vermelho para campo a corrigir, dourado para aviso a ler — e o texto
 * oculto ao lado de cada um, porque a cor não pode ser a unica a dizer.
 */
test('a grade marca o assunto com aviso dentro', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);
  await user.clear(screen.getByRole('textbox', { name: 'WhatsApp' }));
  await user.click(screen.getByRole('button', { name: 'Todos os assuntos' }));

  const loja = await screen.findByRole('button', { name: /^A loja/ });

  expect(within(loja).getByText('tem aviso para ler')).toBeDefined();
  expect(
    within(screen.getByRole('button', { name: /^O brinde/ })).queryByText('tem aviso para ler'),
  ).toBeNull();
});

/* ---- Salvar ------------------------------------------------------------------- */

test('mudar o nome manda só o nome', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);

  const nome = screen.getByRole('textbox', { name: 'Nome da loja' });

  await user.clear(nome);
  await user.type(nome, 'Maison Essence Perfumes');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/settings');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ storeName: 'Maison Essence Perfumes' });
  });
});

test('mudar o número da casa não manda o endereço inteiro', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Retirada na loja', user);

  const numero = screen.getByRole('textbox', { name: 'Número' });

  await user.clear(numero);
  await user.type(numero, '130');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    // O servidor funde campo a campo: mandar o bloco inteiro apagaria o que a
    // tela não mexeu.
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ pickupAddress: { number: '130' } });
  });
});

test('apagar o frete grátis geral manda null, e não zero', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);

  const frete = screen.getByRole('textbox', { name: 'Frete grátis a partir de' });

  await user.clear(frete);
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ freeShippingMinCents: null });
  });
});

/* ---- O brinde ----------------------------------------------------------------- */

/**
 * O brinde e da operação, e o gerente grava.
 *
 * E a mesma natureza do frete grátis logo acima: uma regra de "compre X e
 * ganhe Y", ligada e desligada conforme a campanha do mês. Se ela virasse
 * moldura, a seção sumiria da tela do gerente — e trocar o valor do brinde
 * passaria a depender de quem mantem o sistema.
 */
test('o gerente liga o brinde e escolhe o valor meta', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();
  await entrar('O brinde', user);

  await user.click(screen.getByRole('switch', { name: 'Oferecer brinde' }));
  await user.type(await screen.findByRole('textbox', { name: 'A partir de' }), '179,99');
  await user.type(
    await screen.findByRole('textbox', { name: 'A frase do brinde' }),
    'um porta hidratante',
  );
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({
      gift: { isActive: true, minCents: 17_999, label: 'um porta hidratante' },
    });
  });
});

/**
 * A prévia escreve a frase antes de ela valer.
 *
 * E a única defesa contra a falha silenciosa desta seção: ligar o brinde,
 * salvar e não ver nada acontecer na loja.
 */
test('a prévia mostra a frase que a cliente vai ler', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();
  await entrar('O brinde', user);

  await user.click(screen.getByRole('switch', { name: 'Oferecer brinde' }));
  await user.type(await screen.findByRole('textbox', { name: 'A partir de' }), '179,99');
  await user.type(
    await screen.findByRole('textbox', { name: 'A frase do brinde' }),
    'um porta hidratante',
  );

  expect(await screen.findByText('Na loja, a cliente lê:')).toBeDefined();
  expect(screen.getByText('R$ 179,99')).toBeDefined();
});

test('brinde ligado pela metade diz que não vai aparecer', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();
  await entrar('O brinde', user);

  await user.click(screen.getByRole('switch', { name: 'Oferecer brinde' }));

  expect(await screen.findByText(/o aviso do brinde não aparece na loja/)).toBeDefined();
});

/* ---- A fileira de mais vendidos ------------------------------------------------ */

test('sem escolha, a tela diz que a fileira esta no automático', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Mais vendidos');

  expect(screen.getByText(/A fileira esta no automático/)).toBeDefined();
});

test('escolher um produto manda a fileira inteira, e só ela', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Mais vendidos', user);

  const busca = screen.getByRole('searchbox', { name: 'Adicionar produto a fileira' });

  await user.type(busca, 'yara');

  // O clique sai da seção de propósito, e não da tela: e ela que diz qual
  // fileira recebeu o produto. A busca do perfume da vez, que tem um botão
  // "Escolher Yara Lattafa" igual a este, vive em outro assunto.
  const secao = screen.getByRole('region', { name: 'Mais vendidos' });

  await user.click(
    await within(secao).findByRole('button', { name: /Escolher Yara Lattafa/ }, { timeout: 3000 }),
  );
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ bestSellerProductIds: ['p2'] });
  });
});

test('a fileira montada mostra os produtos na ordem, e tirar um manda a lista sem ele', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);
  SETTINGS.bestSellerProductIds = ['p1', 'p2'];

  try {
    abrir();
    await entrar('Mais vendidos', user);

    const secao = screen.getByRole('region', { name: 'Mais vendidos' });
    const linhas = await within(secao).findAllByRole('listitem');

    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.textContent).toContain('Asad Lattafa');
    expect(linhas[1]?.textContent).toContain('Yara Lattafa');

    await user.click(within(linhas[0]!).getByRole('button', { name: 'Ações de Asad Lattafa' }));
    await user.click(screen.getByRole('button', { name: 'Tirar da fileira' }));
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ bestSellerProductIds: ['p2'] });
    });
  } finally {
    SETTINGS.bestSellerProductIds = [];
  }
});

/* ---- O perfume da vez --------------------------------------------------------- */

test('escolher o perfume da vez manda o id do produto, e só ele', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('O perfume da vez', user);

  const busca = screen.getByRole('searchbox', { name: 'Trocar por outro produto' });

  await user.type(busca, 'asad');

  // O campo consulta na pausa da digitação: o botão aparece quando a resposta
  // chega, e e por ele que o teste espera. O prazo e maior que o padrão de um
  // segundo porque são três esperas em fila — digitação, pausa e consulta.
  await user.click(
    await screen.findByRole('button', { name: /Escolher Asad Lattafa/ }, { timeout: 3000 }),
  );
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ featuredPerfumeProductId: 'p1' });
  });
});

test('sem escolha, a tela diz o que a home esta mostrando no lugar', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('O perfume da vez');

  expect(screen.getByText(/a home mostra o último produto marcado como destaque/)).toBeDefined();
});

test('descartar devolve os campos ao que esta gravado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);

  const aviso = screen.getByRole('textbox', { name: 'Barra de avisos' });

  await user.clear(aviso);
  await user.click(await screen.findByRole('button', { name: 'Descartar' }));

  expect((aviso as HTMLInputElement).value).toBe('Frete grátis acima de R$ 200');
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

/* ---- Os avisos ------------------------------------------------------------------ */

test('apagar o WhatsApp avisa que o pedido fica sem destino', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('A loja', user);

  const whatsapp = screen.getByRole('textbox', { name: 'WhatsApp' });

  await user.clear(whatsapp);

  expect(await screen.findByText(/não tem para onde ser enviado/)).toBeDefined();
});

test('publicar uma página sem texto avisa, e diz qual e', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Páginas do rodapé', user);

  await user.click(screen.getByRole('button', { name: /Como comprar/ }));
  await user.click(screen.getByRole('switch', { name: 'Publicada no site' }));

  expect(await screen.findByText(/Como comprar: publicada sem texto/)).toBeDefined();
});

/* ---- O carrossel ------------------------------------------------------------------ */

test('o banner que já passou diz que encerrou, em vez de parecer no ar', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Banners da home');

  expect(screen.getByText('No ar')).toBeDefined();
  expect(screen.getByText('Encerrado')).toBeDefined();
});

test('descer um banner manda o carrossel inteiro na ordem nova', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Banners da home', user);

  await user.click(screen.getByRole('button', { name: 'Ações de Coleção de verão' }));
  await user.click(screen.getByRole('button', { name: 'Descer' }));
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as {
      banners?: { id?: string; order?: number }[];
    };

    // O array substitui o gravado: vai inteiro, com a ordem que foi arrastada.
    expect(body.banners?.map((banner) => banner.id)).toEqual(['b2', 'b1']);
    expect(body.banners?.map((banner) => banner.order)).toEqual([0, 1]);
  });
});

/**
 * A vaga viaja no mesmo array do resto.
 *
 * E o que separa um banner do topo de um banner do meio da home: sem o campo
 * no corpo do PATCH, a dona trocaria a vaga na tela, salvaria, e a home
 * continuaria desenhando a arte onde ela estava.
 */
test('mudar a vaga do banner manda a escolha no PATCH', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Banners da home', user);

  const [vaga] = screen.getAllByRole('combobox', { name: 'Onde aparece' });

  await user.selectOptions(vaga as HTMLSelectElement, 'middle');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as {
      banners?: { id?: string; placement?: string }[];
    };

    expect(body.banners?.map((banner) => banner.placement)).toEqual(['middle', 'hero']);
  });
});

/**
 * A medida não depende de estado nenhum.
 *
 * É o defeito que este caso previne: uma medida que só aparece quando falta
 * arte, ou quando o ponteiro passa por cima, some justamente na hora de
 * trocar uma imagem que já existe — e quem envia do celular nunca a vê.
 */
test('a medida das duas artes fica na tela, em cada banner e no rodapé', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Banners da home');

  // Uma legenda por arte, nos dois banners da loja de mentira.
  expect(screen.getAllByText('Computador · 1920 × 562 px')).toHaveLength(2);
  expect(screen.getAllByText('Celular · 1200 × 1500 px')).toHaveLength(2);

  // E a linha do rodapé, que não depende de haver espaço no carrossel.
  expect(screen.getByText(/Medida da arte — computador 1920 × 562 px/)).toBeDefined();
});

/* ---- As páginas --------------------------------------------------------------------- */

test('escrever numa página manda só aquela página', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Páginas do rodapé', user);

  await user.click(screen.getByRole('button', { name: /Como comprar/ }));

  const texto = screen.getByRole('textbox', { name: 'Texto' });

  await user.type(texto, 'Escolha, feche e pague.');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as {
      institutionalPages?: { slug: string }[];
    };

    // O servidor atualiza por slug, e a página que não vier fica como esta.
    expect(body.institutionalPages).toHaveLength(1);
    expect(body.institutionalPages?.[0]?.slug).toBe('como-comprar');
  });
});

test('a página fechada diz o essencial: publicada, e se há o que publicar', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Páginas do rodapé');

  const quemSomos = screen.getByRole('button', { name: /Quem somos/ });

  expect(within(quemSomos).getByText('Publicada')).toBeDefined();
  expect(
    within(screen.getByRole('button', { name: /Como comprar/ })).getByText('Sem texto'),
  ).toBeDefined();
});

/* ---- Os cartazes de coleção ------------------------------------------------------ */

/**
 * A faixa do meio da home.
 *
 * O que estes dois casos cobram e o que a seção tem de próprio: a faixa vazia
 * diz o que a home esta mostrando no lugar, e um cartaz só avisa que a faixa
 * desaparece — que e o estado em que a dona salva e não entende o que houve.
 */
test('sem cartaz, a tela diz que a home esta deduzindo a faixa', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Cartazes de coleção');

  // No lugar da lista, e não como aviso: a faixa vazia e o estado inicial de
  // toda loja, e o que a dona precisa saber e o que a home esta mostrando.
  expect(screen.getByText(/A faixa esta vazia/)).toBeDefined();
  expect(screen.getByText(/duas categorias com mais produtos que tenham foto/)).toBeDefined();

  // E a medida da arte fica na tela, como a dos banners.
  expect(screen.getByText(/Medida da arte/).textContent).toContain('1920');
});

test('um cartaz só avisa que a faixa não aparece na home', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  const umSo = {
    ...SETTINGS,
    posters: [
      {
        id: 'c1',
        label: "Victoria's Secret",
        image: 'maison-essence/posters/victorias-secret-00fbe353',
        link: "/produtos?marca=Victoria's%20Secret",
        caption: '',
        order: 0,
        isActive: true,
      },
    ],
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.includes('/admin/products/brands')
            ? BRANDS
            : url.includes('/admin/categories')
              ? CATEGORIES
              : umSo,
        ),
      ),
    ),
  );

  abrir();
  await entrar('Cartazes de coleção');

  expect(screen.getByText(/Só um cartaz ligado/)).toBeDefined();

  // O nome do cartaz aparece na prévia, do jeito que a home o escreve.
  expect(screen.getAllByText("Victoria's Secret").length).toBeGreaterThan(0);
});

/* ---- Nossas marcas ---------------------------------------------------------------- */

/**
 * A faixa de marcas.
 *
 * Marca e campo livre do cadastro do produto, e e isso que põe a mesma casa
 * na home escrita de dois jeitos. O que esta seção precisa fazer, e o que
 * estes casos cobram, e mostrar as grafias do catálogo com o tamanho de cada
 * uma — e deixar escolher dali, nunca digitar.
 */
test('as marcas vem do cadastro, com a contagem de cada grafia', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Nossas marcas');

  expect(await screen.findByRole('button', { name: /Isabelle La Belle/ })).toBeDefined();

  // A marca com produtos, mas nenhum no ar, diz isso antes de ser escolhida:
  // ela abriria uma vitrine vazia.
  expect(screen.getByRole('button', { name: /Lattafa/ }).textContent).toContain('nenhum no ar');
});

test('as grafias parecidas viram aviso, com quantos produtos cada uma tem', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();
  await entrar('Nossas marcas');

  expect(await screen.findByText(/parecem a mesma marca/)).toBeDefined();

  // E o conserto esta escrito, porque não e aqui: e no cadastro do produto.
  expect(screen.getByText(/escrever a marca igual a da maior/)).toBeDefined();
});

test('escolher uma marca manda a faixa inteira, e só ela', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  const user = userEvent.setup();

  abrir();
  await entrar('Nossas marcas', user);

  await user.click(await screen.findByRole('button', { name: /Isabelle La Belle/ }));
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(lastWrite()).toBeDefined();
  });

  expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ brands: ['Isabelle La Belle'] });
});
