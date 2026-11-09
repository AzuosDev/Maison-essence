// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StoreSettingsProvider } from '@/features/settings';
import { GiftBalloon } from './gift-balloon';

/**
 * O balão do brinde.
 *
 * Dois riscos moram aqui, e nenhum dos dois quebra a tela — os dois a deixam
 * mentindo:
 *
 * - **anunciar brinde que a loja não da.** Sem campanha configurada o balão
 *   não pode existir, pelo mesmo motivo que o botão do WhatsApp não existe
 *   sem número: promessa sem dono;
 * - **sumir da loja.** O brinde fica aparente em toda página — decisão da
 *   dona. O × encolhe o cartão no círculo dourado, que continua na tela, e a
 *   página seguinte devolve o cartão inteiro.
 */

const GIFT = {
  minCents: 17_999,
  label: 'um porta hidratante com a melhor pasta árabe dentro',
  image: '',
};

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
  freeShippingMinCents: null,
  gift: GIFT as typeof GIFT | null,
  banners: [],
  shortcuts: [],
};

let configuracoes: Record<string, unknown>;

beforeEach(() => {
  configuracoes = SETTINGS;
  window.sessionStorage.clear();

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

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StoreSettingsProvider>
          {/*
            O link de navegação faz parte da bancada, e não do balão: trocar
            de página na loja de verdade não desmonta a moldura, e e
            exatamente isso que o caso do cartão que volta precisa simular.
          */}
          <Link to="/produtos">Ir para a vitrine</Link>
          <GiftBalloon />
        </StoreSettingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('anuncia o valor e o que a cliente ganha', async () => {
  montar();

  expect(await screen.findByText(/Compre/)).toBeDefined();
  expect(screen.getByText('R$ 179,99')).toBeDefined();
  expect(screen.getByText(/porta hidratante com a melhor pasta árabe dentro/)).toBeDefined();
});

/** O cartão inteiro leva a vitrine: um aviso que não leva a lugar nenhum. */
test('o aviso leva para os produtos', async () => {
  montar();

  const link = await screen.findByRole('link', { name: /Compre/ });

  expect(link.getAttribute('href')).toBe('/produtos');
});

test('sem campanha configurada, não há balão', async () => {
  configuracoes = { ...SETTINGS, gift: null };

  montar();

  // Espera as configurações chegarem: antes delas o balão também não desenha
  // nada, e um `expect` imediato passaria pelo motivo errado.
  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // Nem o cartão nem o círculo: o balão não existe em nenhum tamanho.
  expect(screen.queryByText(/Compre/)).toBeNull();
  expect(screen.queryByRole('button', { name: /brinde/i })).toBeNull();
});

/**
 * Encolhido, o círculo fica — e ele continua dizendo o que há atrás.
 *
 * O nome acessível carrega a oferta inteira porque, encolhido, o círculo e
 * um botão dourado sem texto: para quem navega por leitor de tela ele seria
 * um botão sem assunto.
 */
test('encolher troca o cartão pelo círculo, que ainda anuncia o brinde', async () => {
  const user = userEvent.setup();

  montar();

  await user.click(await screen.findByRole('button', { name: 'Encolher o aviso do brinde' }));

  expect(screen.queryByRole('link', { name: /Compre/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Ver o brinde: compre R\$ 179,99/ })).toBeDefined();
});

test('o círculo devolve o cartão', async () => {
  const user = userEvent.setup();

  montar();

  await user.click(await screen.findByRole('button', { name: 'Encolher o aviso do brinde' }));
  await user.click(screen.getByRole('button', { name: /Ver o brinde/ }));

  expect(screen.getByRole('link', { name: /Compre/ })).toBeDefined();
});

/**
 * Trocar de página devolve o cartão inteiro.
 *
 * E o que "sempre aparente" quer dizer na prática, e o caso que protege a
 * decisão da dona de uma otimização bem-intencionada: o balão mora na
 * moldura da loja e **não** e remontado quando a cliente navega, então sem
 * uma regra explicita um × dado na home valeria para a visita inteira.
 *
 * Por isso o teste troca de rota dentro do mesmo router, em vez de montar de
 * novo: montar de novo zeraria o estado e passaria pelo motivo errado.
 */
test('encolhido numa página, o cartão volta na seguinte', async () => {
  const user = userEvent.setup();

  montar();
  await user.click(await screen.findByRole('button', { name: 'Encolher o aviso do brinde' }));

  await user.click(screen.getByRole('link', { name: 'Ir para a vitrine' }));

  expect(await screen.findByRole('button', { name: 'Encolher o aviso do brinde' })).toBeDefined();
});
