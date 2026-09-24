// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SearchOverlay } from './search-overlay';

/**
 * A busca.
 *
 * Três regras que só se veem contando requisições: o mínimo de três letras,
 * o atraso de 300ms e o histórico local. Conferir isso a olho significaria
 * abrir o inspetor de rede e digitar devagar — e não perceber quando uma
 * delas parar de valer.
 */

const PRODUTOS = {
  items: [
    {
      id: '1',
      name: 'Asad Lattafa',
      slug: 'asad-lattafa',
      brand: 'Lattafa',
      images: [],
      coverImage: '',
      variants: [],
      hasVariants: false,
      priceRangeCents: { min: 18990, max: 18990 },
      discountPercent: 0,
      inStock: true,
      isFeatured: false,
      isReadyToShip: true,
      tags: [],
    },
  ],
  page: 1,
  totalPages: 1,
  totalItems: 1,
  hasMore: false,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();

  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(PRODUTOS))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function abrirBusca() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SearchOverlay open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function chamadasDeBusca(): string[] {
  const mock = fetch as unknown as { mock: { calls: [string][] } };

  return mock.mock.calls.map(([url]) => url).filter((url) => url.includes('/products'));
}

test('abaixo de três letras não consulta o servidor', async () => {
  const user = userEvent.setup();

  abrirBusca();

  await user.type(screen.getByRole('searchbox'), 'pe');

  // Bem mais que o atraso de 300ms: se fosse consultar, já teria consultado.
  await new Promise((resolve) => setTimeout(resolve, 600));

  expect(chamadasDeBusca()).toHaveLength(0);
  expect(screen.getByText(/Digite ao menos 3 letras/)).toBeDefined();
});

test('a partir de três letras consulta uma vez só, depois que a digitação para', async () => {
  const user = userEvent.setup();

  abrirBusca();

  await user.type(screen.getByRole('searchbox'), 'asad');

  await waitFor(() => {
    expect(chamadasDeBusca().length).toBeGreaterThan(0);
  });

  // Quatro letras, uma consulta: o atraso engoliu as intermediarias.
  expect(chamadasDeBusca()).toHaveLength(1);
  expect(chamadasDeBusca()[0]).toContain('q=asad');

  expect(await screen.findByRole('link', { name: /Asad Lattafa/ })).toBeDefined();
});

test('a busca enviada entra no histórico local', async () => {
  const user = userEvent.setup();

  const { unmount } = abrirBusca();

  const campo = screen.getByRole('searchbox');

  await user.type(campo, 'lattafa{Enter}');

  await waitFor(() => {
    expect(localStorage.getItem('maison-essence.recent-searches')).toContain('lattafa');
  });

  unmount();
  cleanup();

  // Ao reabrir, o termo aparece como atalho — e o campo volta vazio.
  abrirBusca();

  expect(screen.getByRole('searchbox')).toHaveProperty('value', '');
  expect(await screen.findByRole('button', { name: 'lattafa' })).toBeDefined();
});

test('da para esquecer uma busca do histórico', async () => {
  const user = userEvent.setup();

  localStorage.setItem('maison-essence.recent-searches', JSON.stringify(['lattafa', 'vela']));

  abrirBusca();

  await user.click(screen.getByRole('button', { name: 'Remover "lattafa" das buscas recentes' }));

  expect(screen.queryByRole('button', { name: 'lattafa' })).toBeNull();
  expect(screen.getByRole('button', { name: 'vela' })).toBeDefined();
  expect(localStorage.getItem('maison-essence.recent-searches')).not.toContain('lattafa');
});
