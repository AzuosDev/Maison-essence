// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { THEME_STORAGE_KEY } from './theme';
import { ThemeProvider } from './theme-context';
import { ThemeIconButton } from './theme-icon-button';
import { ThemeToggle } from './theme-toggle';

/**
 * A loja travada no claro — o que de fato está no ar.
 *
 * Decisão da dona em 29/10/2026: a escolha de tema saiu da tela e o site
 * fica sempre claro. Três coisas precisam ser verdade ao mesmo tempo, e as
 * três têm um jeito próprio de falhar sem ninguém perceber:
 *
 * 1. os dois controles desenham nada — um deles sobrando numa tela seria um
 *    botão que muda o site inteiro sem que ninguém tenha pedido;
 * 2. quem escolheu escuro quando havia escolha não fica preso nele;
 * 3. o celular no modo noturno não decide mais nada.
 *
 * O outro lado desta decisão está em `theme-toggle.spec.tsx`, que religa a
 * escolha e prova que o escuro continua funcionando quando ela voltar.
 */

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');

  // O jsdom não implementa `matchMedia`. Aqui ele responde "o aparelho está
  // no escuro", que é justamente o caso que não pode mais mudar nada.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('o grupo de tema do rodapé não desenha nada', () => {
  const { container } = render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

  expect(container.innerHTML).toBe('');
  expect(screen.queryByRole('radio')).toBeNull();
});

test('o botão de tema do cabeçalho não desenha nada', () => {
  const { container } = render(
    <ThemeProvider>
      <ThemeIconButton />
    </ThemeProvider>,
  );

  expect(container.innerHTML).toBe('');
  expect(screen.queryByRole('button')).toBeNull();
});

test('o escuro guardado antes não prende a loja no escuro', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'dark');

  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

/**
 * O atributo precisa estar escrito, e não só ausente.
 *
 * É ele que desarma o `@media (prefers-color-scheme: dark)` de `tokens.css`:
 * o bloco está sob `:root:not([data-theme='light'])`. Sem o atributo, o
 * celular no modo noturno pintaria a loja escura mesmo sem ninguém ter
 * escolhido.
 */
test('o celular no modo noturno abre a loja no claro', () => {
  render(
    <ThemeProvider>
      <ThemeIconButton />
    </ThemeProvider>,
  );

  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});
