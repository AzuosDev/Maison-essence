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
 * A tela de configuracoes.
 *
 * O que estes casos cobram:
 *
 * - **abrir a tela nao a deixa suja**, que e o risco proprio desta tela: os
 *   banners viajam como instante e sao editados como dia, e um arredondamento
 *   a mais faria a barra de salvar aparecer sozinha a cada abertura;
 * - **so o que mudou viaja**, e o endereco campo a campo — corrigir o numero
 *   da casa nao pode apagar o ponto de referencia;
 * - **o que some do site sem avisar vira aviso escrito**;
 * - **so o administrador do sistema entra**: nem o gerente da loja abre esta
 *   area, porque o que se muda aqui e a moldura inteira e nao o dia de
 *   vender.
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
  banners: [
    {
      id: 'b1',
      imageDesktop: 'banners/verao',
      imageMobile: 'banners/verao-mobile',
      title: 'Coleção de verão',
      subtitle: 'Notas cítricas',
      buttonLabel: 'Ver a coleção',
      link: '/produtos',
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
      order: 1,
      // Agendado para o passado: o banner ja saiu do ar sozinho.
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-01-31T23:59:59.999Z',
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

let calls: { url: string; method: string; body: string }[] = [];

type Settings = typeof SETTINGS;
type Patch = Partial<Settings>;

/**
 * O documento como o servidor o devolve depois do `PATCH`.
 *
 * Os tres comportamentos do backend estao aqui de proposito, e nao um
 * `{ ...SETTINGS, ...patch }`: o endereco e as redes **fundem** campo a
 * campo, as paginas sao casadas por `slug`, e so os banners substituem o
 * array inteiro. Uma resposta parcial seria uma resposta que o servidor nunca
 * manda — e o teste passaria a cobrar da tela uma defesa que nao precisa
 * existir.
 */
function saved(patch: Patch): Settings {
  return {
    ...SETTINGS,
    ...patch,
    pickupAddress: { ...SETTINGS.pickupAddress, ...patch.pickupAddress },
    socialLinks: { ...SETTINGS.socialLinks, ...patch.socialLinks },
    banners: patch.banners ?? SETTINGS.banners,
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

/* ---- Abrir a tela ------------------------------------------------------------ */

test('abre com o que esta gravado, e o número legível', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  const whatsapp = await screen.findByRole('textbox', { name: 'WhatsApp' });

  expect((whatsapp as HTMLInputElement).value).toBe('(88) 99999-9999');
  expect((screen.getByRole('textbox', { name: 'Nome da loja' }) as HTMLInputElement).value).toBe(
    'Maison Essence',
  );
});

test('abrir a tela não a deixa suja, nem com banner agendado', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

  // O banner viaja como instante e e editado como dia. Se a volta nao fosse
  // exata, a barra apareceria sozinha e a dona aprenderia a ignora-la.
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

test('o gerente da loja não entra: isto não e decisão do dia de vender', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem mantem o sistema/ }),
  ).toBeDefined();
});

test('o STAFF também não entra', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem mantem o sistema/ }),
  ).toBeDefined();
});

/* ---- Salvar ------------------------------------------------------------------- */

test('mudar o nome manda só o nome', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  const nome = await screen.findByRole('textbox', { name: 'Nome da loja' });

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

  const numero = await screen.findByRole('textbox', { name: 'Número' });

  await user.clear(numero);
  await user.type(numero, '130');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    // O servidor funde campo a campo: mandar o bloco inteiro apagaria o que a
    // tela nao mexeu.
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ pickupAddress: { number: '130' } });
  });
});

test('apagar o frete grátis geral manda null, e não zero', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  const frete = await screen.findByRole('textbox', { name: 'Frete grátis a partir de' });

  await user.clear(frete);
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ freeShippingMinCents: null });
  });
});

test('descartar devolve os campos ao que esta gravado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  const aviso = await screen.findByRole('textbox', { name: 'Barra de avisos' });

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

  const whatsapp = await screen.findByRole('textbox', { name: 'WhatsApp' });

  await user.clear(whatsapp);

  expect(await screen.findByText(/não tem para onde ser enviado/)).toBeDefined();
});

test('publicar uma página sem texto avisa, e diz qual e', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

  await user.click(screen.getByRole('button', { name: /Como comprar/ }));
  await user.click(screen.getByRole('switch', { name: 'Publicada no site' }));

  expect(await screen.findByText(/Como comprar: publicada sem texto/)).toBeDefined();
});

/* ---- O carrossel ------------------------------------------------------------------ */

test('o banner que já passou diz que encerrou, em vez de parecer no ar', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

  expect(screen.getByText('No ar')).toBeDefined();
  expect(screen.getByText('Encerrado')).toBeDefined();
});

test('descer um banner manda o carrossel inteiro na ordem nova', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

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

/* ---- As paginas --------------------------------------------------------------------- */

test('escrever numa página manda só aquela página', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

  await user.click(screen.getByRole('button', { name: /Como comprar/ }));

  const texto = screen.getByRole('textbox', { name: 'Texto' });

  await user.type(texto, 'Escolha, feche e pague.');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as {
      institutionalPages?: { slug: string }[];
    };

    // O servidor atualiza por slug, e a pagina que nao vier fica como esta.
    expect(body.institutionalPages).toHaveLength(1);
    expect(body.institutionalPages?.[0]?.slug).toBe('como-comprar');
  });
});

test('a página fechada diz o essencial: publicada, e se há o que publicar', async () => {
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir();

  await screen.findByRole('textbox', { name: 'WhatsApp' });

  const quemSomos = screen.getByRole('button', { name: /Quem somos/ });

  expect(within(quemSomos).getByText('Publicada')).toBeDefined();
  expect(
    within(screen.getByRole('button', { name: /Como comprar/ })).getByText('Sem texto'),
  ).toBeDefined();
});
