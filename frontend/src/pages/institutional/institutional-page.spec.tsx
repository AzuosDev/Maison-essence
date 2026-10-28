// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StoreSettingsProvider } from '@/features/settings';
import InstitutionalPage from './institutional-page';

/**
 * A página institucional contra a API.
 *
 * Os casos aqui são os que uma revisão visual não pega:
 *
 * 1. **Página despublicada e 404**, e com `noindex`. De fora, ela não existe
 *    — e um texto que a dona tirou do ar não pode continuar no índice do
 *    Google.
 * 2. **O 404 não pode piscar.** A listagem de páginas chega depois do
 *    primeiro quadro, e uma tela que decide "não existe" antes dela diria
 *    isso em toda visita, por um instante.
 * 3. **A prévia do WhatsApp** sai do próprio texto e vive em tags do
 *    `<head>`, que ninguém vê ao revisar a página.
 */

const PAGES = [
  { slug: 'quem-somos', title: 'Quem somos' },
  { slug: 'trocas-e-devolucoes', title: 'Trocas e devoluções' },
  // Publicada no painel antes de alguém escrever o texto. Acontece: o
  // interruptor e a caixa de texto são decisões separadas.
  { slug: 'como-comprar', title: 'Como comprar' },
];

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: '',
  contactEmail: '',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: false,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: null,
  banners: [],
};

const RETURNS = {
  slug: 'trocas-e-devolucoes',
  title: 'Trocas e devoluções',
  content: [
    '# Regras para trocas e devoluções',
    '',
    'O produto deve estar lacrado, na embalagem original e sem indícios de uso.',
    '',
    '- As solicitações devem ser feitas em até 7 dias corridos.',
    '',
  ].join('\n'),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/pages/trocas-e-devolucoes')) {
        return Promise.resolve(jsonResponse(RETURNS));
      }

      if (url.includes('/pages/como-comprar')) {
        return Promise.resolve(
          jsonResponse({ slug: 'como-comprar', title: 'Como comprar', content: '' }),
        );
      }

      if (url.includes('/pages')) {
        return Promise.resolve(jsonResponse(PAGES));
      }

      if (url.includes('/settings')) {
        return Promise.resolve(jsonResponse(SETTINGS));
      }

      return Promise.resolve(
        jsonResponse({ statusCode: 404, message: 'Página não encontrada.' }, 404),
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function abrirPagina(slug: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const router = createMemoryRouter(
    [{ path: '/institucional/:slug', element: <InstitutionalPage /> }],
    { initialEntries: [`/institucional/${slug}`] },
  );

  render(
    <QueryClientProvider client={client}>
      <StoreSettingsProvider>
        <RouterProvider router={router} />
      </StoreSettingsProvider>
    </QueryClientProvider>,
  );

  return router;
}

function conteudoDaMeta(seletor: string): string {
  return document.head.querySelector(seletor)?.getAttribute('content') ?? '';
}

test('mostra o texto que a dona escreveu, com título e lista', async () => {
  abrirPagina('trocas-e-devolucoes');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Trocas e devoluções' }),
  ).toBeTruthy();

  expect(
    await screen.findByRole('heading', { level: 2, name: 'Regras para trocas e devoluções' }),
  ).toBeTruthy();

  // O item veio como item de lista de verdade, e não como parágrafo com um
  // hífen na frente: e o que faz o marcador dourado existir.
  expect(screen.getByText(/em até 7 dias corridos/).closest('li')).not.toBeNull();
});

test('a prévia compartilhada sai do próprio texto, e não do título repetido', async () => {
  abrirPagina('trocas-e-devolucoes');

  await screen.findByText(/sem indícios de uso/);

  expect(document.title).toBe('Trocas e devoluções — Maison Essence');
  expect(conteudoDaMeta('meta[name="description"]')).toBe(
    'O produto deve estar lacrado, na embalagem original e sem indícios de uso.',
  );
  expect(conteudoDaMeta('meta[name="robots"]')).toBe('');
});

test('oferece as outras páginas publicadas, e nunca a que esta aberta', async () => {
  abrirPagina('trocas-e-devolucoes');

  const outras = await screen.findByRole('navigation', { name: /Outras páginas/ });

  expect(await screen.findByRole('link', { name: 'Quem somos' })).toBeTruthy();
  expect(outras.textContent).not.toContain('Trocas e devoluções');
});

test('manda falar no WhatsApp já dizendo o que a pessoa estava lendo', async () => {
  abrirPagina('trocas-e-devolucoes');

  const link = await screen.findByRole('link', { name: /Falar no WhatsApp/ });
  const href = link.getAttribute('href') ?? '';

  expect(href.startsWith('https://wa.me/5588999998888?text=')).toBe(true);

  // A dona recebe a conversa sabendo de qual página ela veio, em vez de
  // começar por "em que posso ajudar?".
  expect(decodeURIComponent(href)).toContain('Trocas e devoluções');
});

test('página despublicada e 404, e sai do índice do Google', async () => {
  abrirPagina('politica-de-privacidade');

  expect(
    await screen.findByRole('heading', { level: 1, name: /não está publicada/ }),
  ).toBeTruthy();
  expect(conteudoDaMeta('meta[name="robots"]')).toBe('noindex');
});

test('não pisca o 404 enquanto a listagem de páginas não respondeu', () => {
  abrirPagina('politica-de-privacidade');

  // Primeiro quadro: a listagem esta em voo, e ninguém sabe ainda se esta
  // página existe. Dizer "não existe" aqui seria mentir e voltar atras.
  expect(screen.queryByText(/não está publicada/)).toBeNull();
});

test('página publicada sem texto diz o que houve, em vez de um título solto', async () => {
  abrirPagina('como-comprar');

  expect(await screen.findByRole('heading', { level: 1, name: 'Como comprar' })).toBeTruthy();
  // O título vem da listagem e aparece antes da resposta da página, então o
  // aviso e o que se espera aqui.
  expect(await screen.findByText(/ainda está sendo escrito/)).toBeTruthy();
});
