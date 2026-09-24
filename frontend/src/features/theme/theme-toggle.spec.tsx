// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { THEME_STORAGE_KEY } from './theme';
import { ThemeProvider } from './theme-context';
import { ThemeIconButton } from './theme-icon-button';
import { ThemeToggle } from './theme-toggle';

/**
 * O controle de tema contra o documento de verdade.
 *
 * O que importa aqui nao e o desenho: e o atributo no `<html>`, que e a unica
 * coisa que `tokens.css` le. Um controle que marca a opcao certa sem escrever
 * o atributo parece funcionar e nao muda cor nenhuma.
 */

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');

  // O jsdom nao implementa `matchMedia`, e o provedor o consulta para
  // resolver o modo `system`.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function abrir() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

test('as três opções são um grupo de radio, com o sistema marcado de início', () => {
  abrir();

  const opcoes = screen.getAllByRole('radio');

  expect(opcoes).toHaveLength(3);
  expect(screen.getByRole('radio', { name: /sistema/i })).toHaveProperty('checked', true);
});

test('escolher escuro escreve o atributo que o CSS le', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema escuro/i }));

  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

/**
 * Voltar para o sistema **apaga** o atributo.
 *
 * Nao escreve `data-theme="system"`: nao ha seletor para essa palavra em
 * `tokens.css`, e a pagina ficaria presa no claro mesmo com o aparelho no
 * escuro. E a ausencia do atributo que devolve a decisao para a `@media`.
 */
test('voltar para o sistema remove o atributo em vez de escrever a palavra', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema escuro/i }));
  await user.click(screen.getByRole('radio', { name: /sistema/i }));

  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('a escolha sobrevive ao recarregamento, e o sistema não ocupa a chave', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema claro/i }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

  await user.click(screen.getByRole('radio', { name: /sistema/i }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
});

test('a escolha guardada já vem marcada no primeiro render', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'dark');

  abrir();

  expect(screen.getByRole('radio', { name: /tema escuro/i })).toHaveProperty('checked', true);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

/** O rotulo visivel e uma palavra; o grupo precisa dizer do que ele e. */
test('o grupo tem rótulo visível', () => {
  abrir();

  expect(screen.getByRole('group', { name: 'Tema' })).toBeDefined();
});

/* ---- O botao do cabecalho ------------------------------------------------ */

function abrirBotao() {
  return render(
    <ThemeProvider>
      <ThemeIconButton />
    </ThemeProvider>,
  );
}

/**
 * A roda tem tres paradas e volta ao comeco.
 *
 * Tres e o numero que torna um botao que gira aceitavel: o pior caso para
 * voltar ao que estava sao dois toques. Com quatro ou mais, girar deixa de
 * ser atalho e vira caca.
 */
test('o botão gira entre os três modos e volta ao sistema', async () => {
  const user = userEvent.setup();

  abrirBotao();

  // Comeca no sistema: sem atributo, quem decide e a @media.
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

  await user.click(screen.getByRole('button'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');

  await user.click(screen.getByRole('button'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  await user.click(screen.getByRole('button'));
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

/**
 * O nome acessivel diz o estado **e** o destino.
 *
 * E a resposta a objecao de sempre contra um botao que gira: sem dizer para
 * onde vai, o proximo toque e um chute.
 */
test('o botão anuncia o tema atual e para onde vai', async () => {
  const user = userEvent.setup();

  abrirBotao();

  expect(screen.getByRole('button', { name: /tema: sistema\. trocar para claro/i }));

  await user.click(screen.getByRole('button'));

  expect(screen.getByRole('button', { name: /tema: claro\. trocar para escuro/i }));
});

/** Os dois controles leem o mesmo estado: trocar num marca no outro. */
test('o botão e o grupo de radio compartilham a escolha', async () => {
  const user = userEvent.setup();

  render(
    <ThemeProvider>
      <ThemeIconButton />
      <ThemeToggle />
    </ThemeProvider>,
  );

  await user.click(screen.getByRole('button', { name: /trocar para claro/i }));

  expect(screen.getByRole('radio', { name: /tema claro/i })).toHaveProperty('checked', true);
});
