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
 * errado. O degrau do brinde não entra aqui — ele sai de uma constante que
 * nasce desligada (ver `GIFT`), e um teste que a ligasse estaria testando o
 * valor do deploy, não o componente.
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
  banners: [],
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
