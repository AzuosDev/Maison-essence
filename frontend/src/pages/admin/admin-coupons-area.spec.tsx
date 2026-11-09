// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminCouponFormPage from './admin-coupon-form-page';
import AdminCouponsPage from './admin-coupons-page';

/**
 * A área de cupons do painel.
 *
 * O que estes casos cobram:
 *
 * - **os três números da régua** aparecem no cartão, e o que a tela escreve e
 *   o que a decisão precisa: 23 disponíveis, e não 30;
 * - **a esgotada fica em No ar** e diz o que fazer, em vez de sumir no pé da
 *   página no dia em que ela precisa de decisão;
 * - **a home anuncia uma campanha só**, e a que esta na fila diz que esta na
 *   fila — o "liguei o anúncio e não apareceu" e o que mais assusta aqui;
 * - **desligar manda o oposto** e não apaga nada;
 * - **o cadastro manda um desconto só**, e trocar de tipo manda os dois
 *   campos, porque o schema recusa os dois preenchidos;
 * - **a pré-visualização escreve o que a home vai anunciar**, enquanto se
 *   digita;
 * - **o STAFF não entra**: cupom e preço.
 */

const BLACK = {
  id: 'c1',
  code: 'BLACKFRIDAY',
  title: 'Black Friday Maison',
  slug: 'black-friday-maison',
  tagline: 'Os importados que mais saem.',
  percentOff: 20,
  amountOffCents: null,
  discountLabel: '20% OFF',
  maxUses: 50,
  usedCount: 20,
  holdingCount: 7,
  remainingUses: 23,
  startsAt: null,
  endsAt: '2026-11-30T23:59:59.999Z',
  productIds: ['p1', 'p2'],
  wholeStore: false,
  showOnHome: true,
  isActive: true,
  status: 'live',
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

const NATAL = {
  ...BLACK,
  id: 'c2',
  code: 'NATAL',
  title: 'Natal',
  slug: 'natal',
  tagline: '',
  endsAt: '2026-12-25T23:59:59.999Z',
  maxUses: null,
  usedCount: 3,
  holdingCount: 0,
  remainingUses: null,
  productIds: [],
  wholeStore: true,
  showOnHome: true,
  status: 'live',
};

const ESGOTADA = {
  ...BLACK,
  id: 'c3',
  code: 'PRIMEIRA',
  title: 'Primeira compra',
  slug: 'primeira-compra',
  tagline: '',
  endsAt: null,
  maxUses: 10,
  usedCount: 10,
  holdingCount: 0,
  remainingUses: 0,
  showOnHome: false,
  status: 'exhausted',
};

const DESLIGADA = {
  ...BLACK,
  id: 'c4',
  code: 'ANIVERSARIO',
  title: 'Aniversário da loja',
  slug: 'aniversario-da-loja',
  tagline: '',
  endsAt: null,
  maxUses: null,
  usedCount: 12,
  holdingCount: 0,
  remainingUses: null,
  showOnHome: false,
  isActive: false,
  status: 'paused',
};

let calls: { url: string; method: string; body: string }[] = [];
let list: unknown = [BLACK, NATAL, ESGOTADA, DESLIGADA];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  list = [BLACK, NATAL, ESGOTADA, DESLIGADA];

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

      // Os produtos da campanha: o seletor pede um por id, e a busca pede a
      // lista. Nenhum caso daqui depende do conteúdo deles.
      if (url.includes('/admin/products')) {
        return Promise.resolve(
          /\/admin\/products\/[^?]+$/.test(url)
            ? jsonResponse({
                id: 'p1',
                name: 'Asad',
                brand: 'Lattafa',
                coverImage: null,
                isActive: true,
              })
            : jsonResponse({ items: [], page: 1, limit: 8, total: 0, pages: 0 }),
        );
      }

      if (method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (method === 'POST') {
        return Promise.resolve(jsonResponse(BLACK, 201));
      }

      // O PATCH devolve o cupom com o que foi mandado por cima: e o que o
      // servidor faria, e e disso que o cartão tira o verde de "salvo".
      if (method === 'PATCH') {
        const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as object;

        return Promise.resolve(jsonResponse({ ...BLACK, ...patch }));
      }

      if (/\/admin\/coupons\/[^?]+$/.test(url)) {
        return Promise.resolve(jsonResponse(BLACK));
      }

      return Promise.resolve(jsonResponse(list));
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

/** Monta as telas sem a moldura do painel: o guarda tem os casos dele. */
function abrir(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      { path: '/admin/cupons', Component: AdminCouponsPage },
      { path: '/admin/cupons/nova', Component: AdminCouponFormPage },
      { path: '/admin/cupons/:id', Component: AdminCouponFormPage },
    ],
    { initialEntries: [path] },
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
  return calls.findLast((call) => call.method === 'POST' || call.method === 'PATCH');
}

/* ---- A lista ------------------------------------------------------------- */

/**
 * A conta que a tela precisa acertar.
 *
 * Cupom de 50 com 20 vendidos e 7 em pedidos abertos tem 23 vagas, e não 30.
 * E com 30 na cabeça que alguém promete o código a mais dez pessoas.
 */
test('o cartão escreve vendidos, em aberto e disponíveis', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  const code = await screen.findByRole('heading', { name: 'BLACKFRIDAY' });
  const card = code.closest('article');

  expect(card).not.toBeNull();
  expect(
    within(card as HTMLElement).getByText('20 vendidos, 7 em pedidos abertos, 23 disponíveis de 50'),
  ).toBeDefined();
  expect(within(card as HTMLElement).getByText('20% OFF')).toBeDefined();
  expect(within(card as HTMLElement).getByText('Até 30/11')).toBeDefined();
  expect(within(card as HTMLElement).getByText('2 produtos')).toBeDefined();
});

test('a contagem do alto separa no ar, esgotada e agendada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  expect(await screen.findByText('2 campanhas no ar, 1 esgotada')).toBeDefined();
});

/** Os três grupos, com a esgotada em No ar e a desligada em Encerradas. */
test('agrupa por estado, e a esgotada fica no grupo do ar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  const noAr = await screen.findByRole('region', { name: /No ar/ });

  expect(within(noAr).getByRole('heading', { name: 'BLACKFRIDAY' })).toBeDefined();
  expect(within(noAr).getByRole('heading', { name: 'PRIMEIRA' })).toBeDefined();

  const encerradas = screen.getByRole('region', { name: /Encerradas/ });

  expect(within(encerradas).getByRole('heading', { name: 'ANIVERSARIO' })).toBeDefined();
});

/** A esgotada diz o que fazer, em vez de só mudar de cor. */
test('a campanha esgotada explica que o código para de valer', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  const code = await screen.findByRole('heading', { name: 'PRIMEIRA' });
  const card = code.closest('article') as HTMLElement;

  expect(within(card).getByText('Esgotada')).toBeDefined();
  expect(within(card).getByText(/Aumente o limite/)).toBeDefined();
});

/**
 * A home anuncia uma campanha só, e a tela diz qual.
 *
 * As duas têm o anúncio ligado; a Black Friday termina primeiro e por isso
 * ganha a vaga. Sem essa distinção, as duas levariam o selo "na home" e a
 * tarde viraria uma procura por que o Natal não aparece.
 */
test('só a campanha que termina primeiro leva o selo da home', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  const black = (await screen.findByRole('heading', { name: 'BLACKFRIDAY' })).closest(
    'article',
  ) as HTMLElement;
  const natal = screen.getByRole('heading', { name: 'NATAL' }).closest('article') as HTMLElement;

  expect(within(black).getByText('na home')).toBeDefined();
  expect(within(natal).queryByText('na home')).toBeNull();
  expect(within(natal).getByText(/entra quando a de agora sair do ar/)).toBeDefined();
});

test('desligar a campanha manda o oposto do que esta gravado', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons');

  const card = (await screen.findByRole('heading', { name: 'BLACKFRIDAY' })).closest(
    'article',
  ) as HTMLElement;

  await userEvent.click(within(card).getByRole('button', { name: 'Ações de BLACKFRIDAY' }));
  await userEvent.click(screen.getByRole('button', { name: 'Desligar campanha' }));

  await waitFor(() => {
    expect(lastWrite()?.method).toBe('PATCH');
  });

  expect(lastWrite()?.url).toContain('/admin/coupons/c1');
  expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ isActive: false });
});

/** Excluir nomeia o cupom antes de confirmar, e só o administrador alcança. */
test('o gerente não vê excluir, e o administrador confirma pelo código', async () => {
  signInAs(USER_ROLES.OWNER);

  const owner = abrir('/admin/cupons');
  const card = (await screen.findByRole('heading', { name: 'BLACKFRIDAY' })).closest(
    'article',
  ) as HTMLElement;

  await userEvent.click(within(card).getByRole('button', { name: 'Ações de BLACKFRIDAY' }));

  expect(screen.queryByRole('button', { name: 'Excluir cupom' })).toBeNull();

  owner.unmount();
  useAdminSession.getState().signOut();
  signInAs(USER_ROLES.SUPER_ADMIN);

  abrir('/admin/cupons');

  const again = (await screen.findByRole('heading', { name: 'BLACKFRIDAY' })).closest(
    'article',
  ) as HTMLElement;

  await userEvent.click(within(again).getByRole('button', { name: 'Ações de BLACKFRIDAY' }));
  await userEvent.click(screen.getByRole('button', { name: 'Excluir cupom' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Excluir este cupom?')).toBeDefined();
  // O código aparece no diálogo como o alvo que se confere antes de confirmar.
  expect(within(dialog).getByText('BLACKFRIDAY', { selector: 'p' })).toBeDefined();
});

test('o STAFF não entra na área de cupons', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/cupons');

  expect(
    await screen.findByRole('heading', { name: 'Esta área e de quem administra a loja' }),
  ).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'BLACKFRIDAY' })).toBeNull();
});

/* ---- O cadastro ---------------------------------------------------------- */

test('o código vira maiúscula e perde o que não e letra nem número', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/nova');

  const code = await screen.findByRole('textbox', { name: /Código/ });

  await userEvent.type(code, 'black-friday!');

  expect((code as HTMLInputElement).value).toBe('BLACKFRIDAY');
});

/**
 * O corpo do cadastro manda um desconto só.
 *
 * `percentOff: 20` com `amountOffCents: null`. Os dois preenchidos são
 * recusados pelo schema, e e justamente esse erro que o grupo de duas opções
 * existe para impedir.
 */
test('cadastrar manda o percentual e anula o valor em reais', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/nova');

  await userEvent.type(await screen.findByRole('textbox', { name: /Código/ }), 'BLACK');
  await userEvent.type(screen.getByRole('textbox', { name: /Nome da campanha/ }), 'Black Friday');
  await userEvent.type(screen.getByRole('textbox', { name: /Quanto tira/ }), '20');

  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cupom' }));

  await waitFor(() => {
    expect(lastWrite()?.method).toBe('POST');
  });

  expect(JSON.parse(lastWrite()?.body ?? '{}')).toMatchObject({
    code: 'BLACK',
    title: 'Black Friday',
    percentOff: 20,
    amountOffCents: null,
    maxUses: null,
    productIds: [],
    showOnHome: false,
    isActive: true,
  });
});

test('escolher valor em reais troca o campo e manda centavos', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/nova');

  await userEvent.type(await screen.findByRole('textbox', { name: /Código/ }), 'TRINTA');
  await userEvent.type(screen.getByRole('textbox', { name: /Nome da campanha/ }), 'Trinta reais');
  await userEvent.click(screen.getByRole('radio', { name: /Valor em reais/ }));
  await userEvent.type(screen.getByRole('textbox', { name: /Quanto tira/ }), '30,00');

  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cupom' }));

  await waitFor(() => {
    expect(lastWrite()?.method).toBe('POST');
  });

  expect(JSON.parse(lastWrite()?.body ?? '{}')).toMatchObject({
    percentOff: null,
    amountOffCents: 3000,
  });
});

/** A validação e a nossa, em português, e acontece antes da viagem. */
test('recusa salvar sem código e sem nome, e não chama o servidor', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/nova');

  await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar cupom' }));

  expect(await screen.findByText('Falta corrigir alguma coisa acima.')).toBeDefined();
  expect(lastWrite()).toBeUndefined();
});

/**
 * A pré-visualização e o único lugar onde o nome da campanha faz algo.
 *
 * Código, desconto, prazo e limite têm consequência visível no painel. O nome
 * e a linha de apoio só existem na loja aberta, e escrevê-los no escuro seria
 * publicar para ver.
 */
test('a pré-visualização escreve o que a home vai anunciar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/nova');

  await userEvent.type(await screen.findByRole('textbox', { name: /Código/ }), 'BLACK');
  await userEvent.type(screen.getByRole('textbox', { name: /Nome da campanha/ }), 'Black Friday');
  await userEvent.type(screen.getByRole('textbox', { name: /Quanto tira/ }), '20');

  expect(screen.getByText('Black Friday')).toBeDefined();
  expect(screen.getByText('20% OFF')).toBeDefined();
  expect(screen.getByText('BLACK')).toBeDefined();
});

/** Editar e abrir o cupom salvo, com a régua dos números de verdade. */
test('a edição abre com o cupom salvo e mostra a régua de agora', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/c1');

  const code = await screen.findByRole('textbox', { name: /Código/ });

  expect((code as HTMLInputElement).value).toBe('BLACKFRIDAY');
  expect((screen.getByRole('textbox', { name: /Limite de usos/ }) as HTMLInputElement).value).toBe(
    '50',
  );
  expect(screen.getByText('Como esta agora')).toBeDefined();
});

/** Sair sem mexer em nada não gasta chamada. */
test('salvar sem alterar nada não chama o servidor', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/c1');

  await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(screen.queryByText('Falta corrigir alguma coisa acima.')).toBeNull();
  });

  expect(lastWrite()).toBeUndefined();
});

/**
 * Baixar o limite abaixo do comprometido avisa, e não recusa.
 *
 * E uma decisão legitima — e como se encerra uma campanha que vendeu demais
 * sem desligá-la. O que não pode e virar surpresa.
 */
test('baixar o limite abaixo do comprometido avisa antes de salvar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir('/admin/cupons/c1');

  const max = await screen.findByRole('textbox', { name: /Limite de usos/ });

  await userEvent.clear(max);
  await userEvent.type(max, '10');

  expect(await screen.findByText(/já comprometeu 27 cupons/)).toBeDefined();
});

test('o STAFF não abre o cadastro de cupom', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir('/admin/cupons/nova');

  expect(
    await screen.findByRole('heading', { name: 'Esta área e de quem administra a loja' }),
  ).toBeDefined();
});
