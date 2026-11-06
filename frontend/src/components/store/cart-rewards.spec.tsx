// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StoreSettingsProvider } from '@/features/settings';
import { CartRewards } from './cart-rewards';

/**
 * A régua de benefícios da sacola.
 *
 * O que estes casos protegem e a aritmética, que e onde uma régua erra sem
 * quebrar: ela continua desenhando uma barra bonita enquanto anuncia o valor
 * errado. Com dois degraus — frete grátis e brinde — o erro mais caro e a
 * barra que encolhe: quem acabou de passar do frete grátis vê o progresso
 * dele voltar ao começo se a medida for feita do zero.
 */

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '',
  whatsappLink: '',
  announcementText: '',
  contactEmail: '',
  businessHours: '',
  socialLinks: { instagram: '', tiktok: '' },
  pickupEnabled: false,
  pickupAddress: null,
  pickupInstructions: '',
  freeShippingMinCents: 25_000,
  gift: null as { minCents: number; label: string; image: string } | null,
  banners: [],
};

/** A campanha da loja: brinde a partir de R$ 300. */
const BRINDE = {
  minCents: 30_000,
  label: 'um porta hidratante com a melhor pasta árabe dentro',
  image: '',
};

let configuracoes: Record<string, unknown>;

beforeEach(() => {
  configuracoes = SETTINGS;

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(url.includes('/settings') ? configuracoes : []), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(subtotalCents: number | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <StoreSettingsProvider>
        <CartRewards subtotalCents={subtotalCents} />
      </StoreSettingsProvider>
    </QueryClientProvider>,
  );
}

test('diz quanto falta para o frete grátis', async () => {
  montar(18_000);

  expect(await screen.findByText(/Faltam/)).toBeDefined();
  expect(screen.getByText('R$ 70,00')).toBeDefined();
});

test('alcancado o mínimo, a régua confirma em vez de pedir mais', async () => {
  montar(25_000);

  expect(await screen.findByText('Frete grátis liberado neste pedido.')).toBeDefined();
  expect(screen.queryByText(/Faltam/)).toBeNull();
});

/**
 * Sem regra de frete grátis não há régua.
 *
 * E o caso da loja que cobra frete sempre. Uma barra vazia ali seria uma
 * promessa de benefício que não existe.
 */
test('sem mínimo cadastrado, a régua não existe', async () => {
  configuracoes = { ...SETTINGS, freeShippingMinCents: null };

  const { container } = montar(18_000);

  // Espera as configurações chegarem: antes delas o componente também não
  // desenha nada, e um `expect` imediato passaria pelo motivo errado.
  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  expect(container.textContent).toBe('');
});

/**
 * Alcancado o frete grátis, a régua passa a perseguir o brinde.
 *
 * E o degrau que a loja ganhou quando o brinde virou campo no painel: antes
 * dele, a régua parava de pedir no primeiro benefício.
 */
test('com os dois degraus, o seguinte e o brinde', async () => {
  configuracoes = { ...SETTINGS, gift: BRINDE };

  montar(26_000);

  expect(await screen.findByText(/Faltam/)).toBeDefined();
  expect(screen.getByText('R$ 40,00')).toBeDefined();
  expect(
    screen.getByText(/um porta hidratante com a melhor pasta árabe dentro/),
  ).toBeDefined();
});

/**
 * A barra mede do degrau anterior, e não do zero.
 *
 * Uma sacola de R$ 260 com frete grátis em R$ 250 e brinde em R$ 300 esta a
 * 20% do trecho novo. Medindo do zero daria 86%, e a barra cheia prometeria
 * um brinde que ainda esta a quarenta reais de distância.
 */
test('a barra recomeça no degrau que acabou de ser alcancado', async () => {
  configuracoes = { ...SETTINGS, gift: BRINDE };

  const { container } = montar(26_000);

  await screen.findByText(/Faltam/);

  const fill = container.querySelector<HTMLElement>('[style*="scaleX"]');

  expect(fill?.style.transform).toBe('scaleX(0.200)');
});

test('alcancados os dois, a régua confirma o brinde', async () => {
  configuracoes = { ...SETTINGS, gift: BRINDE };

  montar(30_000);

  expect(
    await screen.findByText(/Brinde liberado: um porta hidratante com a melhor pasta árabe dentro./),
  ).toBeDefined();
  expect(screen.queryByText(/Faltam/)).toBeNull();
});

/** Loja sem campanha: o brinde some da régua sem deixar buraco. */
test('sem brinde configurado, a régua para no frete grátis', async () => {
  montar(25_000);

  expect(await screen.findByText('Frete grátis liberado neste pedido.')).toBeDefined();
  expect(screen.queryByText(/[Bb]rinde/)).toBeNull();
});

/**
 * Enquanto a cotação não volta, a régua não arrisca um número.
 *
 * O subtotal e do servidor. Desenhar "faltam R$ 250" com a sacola ainda
 * sendo cotada mostraria o valor de uma sacola vazia para quem acabou de
 * adicionar um item.
 */
test('sem subtotal cotado, a régua não desenha', () => {
  const { container } = montar(null);

  expect(container.textContent).toBe('');
});
