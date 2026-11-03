// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { useAdminSession, USER_ROLES, type AdminUser, type UserRole } from '@/features/auth';
import AdminPaymentsPage from './admin-payments-page';

/**
 * A tela de pagamento.
 *
 * O que estes casos cobram:
 *
 * - **a prévia e ao vivo e lê o rascunho**, que e a razão de a tela existir
 *   desse jeito: a dona decide olhando a lista, antes de gravar;
 * - **a barra diz que o que se vê ainda não vale**, porque a prévia mudando
 *   na hora e fácil de ler como "já esta no ar";
 * - **só o que mudou viaja**, num documento único que o celular da dona pode
 *   estar editando ao mesmo tempo;
 * - **a tabela de taxas tem duas colunas e a prévia mostra as duas**, que e
 *   a comparação de onde sai a decisão de absorver ou repassar;
 * - **a chave PIX e conferida contra o tipo antes de viajar**;
 * - **o STAFF não entra**: aqui esta a chave para onde vai o dinheiro.
 */

const SETTINGS = {
  acceptsPix: true,
  pixKey: '12345678901',
  pixKeyType: 'cpf',
  pixDiscountPercent: 5,
  acceptsCard: true,
  maxInstallments: 12,
  interestFreeUpTo: 6,
  cardRates: [
    { installments: 1, linkPercent: 4.2, tapPercent: 2.2 },
    { installments: 2, linkPercent: 6.09, tapPercent: 4.09 },
    { installments: 3, linkPercent: 7.01, tapPercent: 5.01 },
    { installments: 4, linkPercent: 7.91, tapPercent: 5.91 },
    { installments: 5, linkPercent: 8.8, tapPercent: 6.8 },
    { installments: 6, linkPercent: 9.67, tapPercent: 7.67 },
    { installments: 7, linkPercent: 12.59, tapPercent: 10.59 },
    { installments: 8, linkPercent: 13.42, tapPercent: 11.42 },
    { installments: 9, linkPercent: 14.25, tapPercent: 12.25 },
    { installments: 10, linkPercent: 15.06, tapPercent: 13.06 },
    { installments: 11, linkPercent: 15.87, tapPercent: 13.87 },
    { installments: 12, linkPercent: 16.66, tapPercent: 14.66 },
  ],
  // A loja nasce no plano padrão com o Nitro em branco: tabela guardada para
  // um plano que ninguém usa envelhece sem ninguém olhar.
  nitroCardRates: [] as { installments: number; linkPercent: number; tapPercent: number }[],
  activeCardPlan: 'standard',
  minInstallmentCents: 2000,
  updatedAt: '2026-09-01T12:00:00.000Z',
};

let calls: { url: string; method: string; body: string }[] = [];

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

      // O servidor devolve o documento inteiro com o que foi mandado por
      // cima, já normalizado. E disso que a tela reabre o rascunho.
      const patch = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as object;

      return Promise.resolve(jsonResponse({ ...SETTINGS, ...patch }));
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

  const router = createMemoryRouter([{ path: '/admin/pagamento', Component: AdminPaymentsPage }], {
    initialEntries: ['/admin/pagamento'],
  });

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
 * A célula de 7x na coluna do link.
 *
 * Sete porque e a primeira parcela acima do limite que a loja absorve: mexer
 * nela muda a lista da prévia, e mexer numa das seis de cima não mudaria
 * nada visível.
 *
 * Relida a cada uso, e não guardada numa variável: "Descartar" reabre o
 * rascunho e o React troca o elemento, e um nó guardado de antes continuaria
 * respondendo com o valor que tinha quando foi capturado.
 */
function taxaDoLink(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Taxa do link em 7x' }) as HTMLInputElement;
}

function previa() {
  return screen.getByRole('complementary', { name: 'Prévia do pagamento' });
}

/* ---- O que a tela mostra ------------------------------------------------------ */

test('abre com as regras gravadas, e a chave pontuada', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  // Onze digitos corridos ninguém confere olhando, e conferir e a única
  // coisa que se faz neste campo.
  expect((key as HTMLInputElement).value).toBe('123.456.789-01');
  expect(taxaDoLink().value).toBe('12,59');
  expect(
    (screen.getByRole('textbox', { name: 'Taxa da maquininha em 7x' }) as HTMLInputElement).value,
  ).toBe('10,59');
});

test('o STAFF não entra: aqui esta a chave para onde vai o dinheiro', async () => {
  signInAs(USER_ROLES.STAFF);

  abrir();

  expect(
    await screen.findByRole('heading', { name: /Esta área e de quem administra a loja/ }),
  ).toBeDefined();
});

/* ---- A prévia ao vivo ---------------------------------------------------------- */

test('a prévia de R$ 300 separa o que tem juros do que não tem', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const painel = previa();

  // Até 6x sem juros: 3x de R$ 100,00, e o total não muda.
  expect(within(painel).getByText('de R$ 100,00')).toBeDefined();

  // 7x já repassa a taxa, e o total sobe. Os mesmos centavos do backend.
  expect(within(painel).getByText('de R$ 49,03')).toBeDefined();
  expect(within(painel).getByText('R$ 343,21')).toBeDefined();
});

/**
 * A razão de a modalidade existir: a mesma compra, nas mesmas parcelas,
 * custa valores diferentes. Se as duas listas mostrarem o mesmo número, a
 * coluna da tabela não esta sendo escolhida por ninguém.
 */
test('a prévia mostra as duas modalidades com valores diferentes', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const painel = previa();

  expect(within(painel).getByText('Com juros, pelo link')).toBeDefined();
  expect(within(painel).getByText('Com juros, na maquininha')).toBeDefined();

  // 7x: R$ 343,21 pelo link, R$ 335,53 na maquininha.
  expect(within(painel).getByText('R$ 343,21')).toBeDefined();
  expect(within(painel).getByText('R$ 335,53')).toBeDefined();
});

/** O custo de absorver a taxa, que não aparece em nenhum outro lugar. */
test('a prévia diz quanto a loja recebe nas parcelas que absorve', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  // R$ 300 em 6x sem juros: 9,67% no link e 7,67% na maquininha.
  expect(within(previa()).getByText(/R\$ 270,99 pelo link e R\$ 276,99 na maquininha/)).toBeDefined();
});

test('mexer no limite sem juros muda a lista antes de salvar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.selectOptions(screen.getByRole('combobox', { name: 'Sem juros até' }), '3');

  await waitFor(() => {
    // 4x saiu do grupo sem juros e virou financiado: R$ 300 em 4x a 1,99%.
    expect(within(previa()).queryByText('de R$ 75,00')).toBeNull();
  });

  // E nada viajou: a prévia lê o rascunho, não o que esta gravado.
  expect(lastWrite()).toBeUndefined();
});

test('a prévia do PIX mostra o desconto sobre o valor cheio', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const painel = previa();

  expect(within(painel).getByText('R$ 285,00')).toBeDefined();
  expect(within(painel).getByText(/R\$ 15,00 de desconto/)).toBeDefined();
});

test('num pedido pequeno, a parcela mínima corta a lista e diz que cortou', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  const amount = screen.getByRole('textbox', { name: 'Num pedido de' });

  await user.clear(amount);
  await user.type(amount, '90,00');

  // R$ 90 em 5x daria R$ 18, abaixo do mínimo de R$ 20. A lista acaba em 4x,
  // e a única pista disso e esta frase — que precisa aparecer mesmo sem
  // nenhuma parcela com juros na tela.
  expect(await within(previa()).findByText(/Faltam 8 opções na lista/)).toBeDefined();
  expect(within(previa()).queryByText('de R$ 18,00')).toBeNull();
});

/* ---- A barra de salvar ---------------------------------------------------------- */

test('sem mexer em nada não há barra de salvar', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

test('a barra avisa que a prévia ainda não vale para quem esta comprando', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(taxaDoLink());
  await user.type(taxaDoLink(), '13,00');

  expect(await screen.findByText(/continua vendo as regras antigas/)).toBeDefined();
});

test('salvar manda só o campo alterado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const minima = await screen.findByRole('textbox', { name: 'Parcela mínima' });

  await user.clear(minima);
  await user.type(minima, '30,00');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const write = lastWrite();

    expect(write?.method).toBe('PATCH');
    expect(write?.url).toContain('/admin/payment-settings');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ minInstallmentCents: 3000 });
  });
});

/**
 * A tabela sobe inteira, e não a célula mexida: mandar só a linha obrigaria
 * o servidor a adivinhar o que fazer com as parcelas que não vieram.
 */
test('mexer numa taxa manda a tabela inteira, com a célula nova dentro', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(taxaDoLink());
  await user.type(taxaDoLink(), '13,00');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as {
      cardRates?: { installments: number; linkPercent: number; tapPercent: number }[];
    };

    expect(Object.keys(body)).toEqual(['cardRates']);
    expect(body.cardRates).toHaveLength(12);
    expect(body.cardRates?.[6]).toEqual({
      installments: 7,
      linkPercent: 13,
      tapPercent: 10.59,
    });
  });
});

test('descartar devolve os campos ao que esta gravado', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(taxaDoLink());
  await user.type(taxaDoLink(), '9,90');
  await user.click(await screen.findByRole('button', { name: 'Descartar' }));

  expect(taxaDoLink().value).toBe('12,59');
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});

/* ---- A chave PIX ----------------------------------------------------------------- */

test('a chave errada para o tipo escolhido não viaja', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);
  await user.type(key, 'loja@exemplo.com.br');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/deve ter 11 digitos/)).toBeDefined();
  expect(lastWrite()).toBeUndefined();
});

test('trocar só o tipo manda a chave junto, porque o servidor confere o par', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo da chave' }), 'random');
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(JSON.parse(lastWrite()?.body ?? '{}')).toEqual({ pixKeyType: 'random', pixKey: '' });
  });
});

test('PIX ligado sem chave avisa, e mesmo assim deixa salvar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  const key = await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.clear(key);

  // O servidor aceita. O que ele não faz e avisar que o PIX parou de
  // aparecer para a cliente.
  expect(await screen.findByText(/sem chave cadastrada ele não aparece/)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDefined();
});

test('desligar as duas formas avisa que a loja ficou sem pagamento', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  await user.click(screen.getByRole('switch', { name: 'Aceitar PIX' }));
  await user.click(screen.getByRole('switch', { name: 'Aceitar cartão' }));

  expect(await screen.findByText(/Nenhuma forma de pagamento esta ligada/)).toBeDefined();
});

/* ---- Os dois planos ------------------------------------------------------------ */

/**
 * O Nitro adianta o dinheiro da venda parcelada e cobra mais por isso.
 *
 * O que estes casos cobram e o que só a tela pode errar: abrir no plano
 * errado, deixar ligar um plano sem tabela, e — o pior dos três — recusar a
 * gravação por causa de uma linha que esta na aba fechada, sem dizer onde
 * ela esta.
 */

function aba(nome: RegExp): HTMLElement {
  return screen.getByRole('tab', { name: nome });
}

test('abre no plano em uso, e diz qual e', async () => {
  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });

  expect(aba(/Padrão/).getAttribute('aria-selected')).toBe('true');
  expect(aba(/Padrão/).textContent).toContain('em uso');
  expect(aba(/Nitro/).getAttribute('aria-selected')).toBe('false');
});

test('o plano sem tabela não pode ser ligado, e a tela diz por que', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });
  await user.click(aba(/Nitro/));

  const botao = screen.getByRole('button', { name: 'Usar o Nitro' }) as HTMLButtonElement;

  expect(botao.disabled).toBe(true);
  expect(screen.getByText(/Preencha a tabela abaixo para poder usar este plano/)).toBeDefined();
});

/**
 * Preencher a tabela e liga-la são uma gravação só.
 *
 * Com duas, a primeira metade salva e a segunda esquecida deixaria a loja
 * cobrando pela tabela errada — e a ordem inversa nem chega ao banco: ligar
 * um plano de tabela vazia e 422 do lado de lá.
 */
test('preencher o Nitro e liga-lo sobe num PATCH só', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });
  await user.click(aba(/Nitro/));

  await user.type(screen.getByRole('textbox', { name: 'Taxa do link em 7x' }), '13,50');
  await user.type(screen.getByRole('textbox', { name: 'Taxa da maquininha em 7x' }), '11,00');

  // A linha que decide: em reais, e não em percentual. 7x de R$ 300 pelo
  // link custa R$ 343,21 no padrão e R$ 346,82 no Nitro.
  expect(
    within(previa()).getByText(/a cliente pagaria R\$ 3,61 a mais em 7x pelo link/),
  ).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Usar o Nitro' }));
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    const body = JSON.parse(lastWrite()?.body ?? '{}') as Record<string, unknown>;

    expect(Object.keys(body).toSorted()).toEqual(['activeCardPlan', 'nitroCardRates']);
    expect(body.activeCardPlan).toBe('nitro');
    expect(body.nitroCardRates).toEqual([
      { installments: 7, linkPercent: 13.5, tapPercent: 11 },
    ]);
  });
});

/**
 * O erro da aba fechada e o jeito mais fácil de esta tela virar um botão que
 * não faz nada: a tabela parada sobe no mesmo `PATCH`, meia linha nela
 * recusa a gravação inteira, e a célula culpada esta fora da vista.
 */
test('meia linha no plano parado marca a aba dele e segura a gravação', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });
  await user.click(aba(/Nitro/));

  await user.type(screen.getByRole('textbox', { name: 'Taxa do link em 7x' }), '13,50');

  await user.click(aba(/Padrão/));
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(lastWrite()).toBeUndefined();
  expect(aba(/Nitro/).textContent).toContain('tem erro para corrigir');
});

test('trocar de aba não e uma alteração para salvar', async () => {
  const user = userEvent.setup();

  signInAs(USER_ROLES.OWNER);

  abrir();

  await screen.findByRole('textbox', { name: 'Chave PIX' });
  await user.click(aba(/Nitro/));

  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
});
