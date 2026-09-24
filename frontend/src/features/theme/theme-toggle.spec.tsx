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
 * O que importa aqui não é o desenho: é o atributo no `<html>`, que é a única
 * coisa que `tokens.css` lê. Um controle que marca a opção certa sem escrever
 * o atributo parece funcionar e não muda cor nenhuma.
 */

/** O aparelho responde o que o teste mandar; o padrão é claro. */
function aparelhoNoEscuro(escuro: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: escuro,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');

  // O jsdom não implementa `matchMedia`, e o provedor o consulta para decidir
  // com que tema a loja abre para quem nunca escolheu.
  aparelhoNoEscuro(false);
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

test('as duas opções são um grupo de radio, com o claro marcado de início', () => {
  abrir();

  const opcoes = screen.getAllByRole('radio');

  expect(opcoes).toHaveLength(2);
  expect(screen.getByRole('radio', { name: /tema claro/i })).toHaveProperty('checked', true);
});

/** O modo que saiu não pode sobreviver escondido num rótulo. */
test('não há mais opção de sistema', () => {
  abrir();

  expect(screen.queryByRole('radio', { name: /sistema/i })).toBeNull();
});

test('escolher escuro escreve o atributo que o CSS lê', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema escuro/i }));

  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

/**
 * O atributo está sempre lá.
 *
 * Com o modo `system`, a ausência do atributo era um estado — era ela que
 * devolvia a decisão para a `@media` de `tokens.css`. Agora as duas opções
 * escrevem, e é o que impede a loja de voltar ao escuro do aparelho depois de
 * alguém escolher claro.
 */
test('voltar para o claro escreve o atributo, e não o apaga', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema escuro/i }));
  await user.click(screen.getByRole('radio', { name: /tema claro/i }));

  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('as duas escolhas sobrevivem ao recarregamento', async () => {
  const user = userEvent.setup();

  abrir();

  await user.click(screen.getByRole('radio', { name: /tema escuro/i }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

  await user.click(screen.getByRole('radio', { name: /tema claro/i }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
});

test('a escolha guardada já vem marcada no primeiro render', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'dark');

  abrir();

  expect(screen.getByRole('radio', { name: /tema escuro/i })).toHaveProperty('checked', true);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

/**
 * O aparelho decide o primeiro encontro, e só ele.
 *
 * É o que sobrou do modo `system`: quem chega de um celular no modo noturno
 * abre a loja no escuro, com o segmento "Escuro" marcado dizendo isso.
 */
test('sem escolha guardada, a loja abre no tema do aparelho', () => {
  aparelhoNoEscuro(true);

  abrir();

  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('radio', { name: /tema escuro/i })).toHaveProperty('checked', true);
});

/** O rótulo visível é uma palavra; o grupo precisa dizer do que ele é. */
test('o grupo tem rótulo visível', () => {
  abrir();

  expect(screen.getByRole('group', { name: 'Tema' })).toBeDefined();
});

/* ---- O botão do cabeçalho ------------------------------------------------ */

function abrirBotao() {
  return render(
    <ThemeProvider>
      <ThemeIconButton />
    </ThemeProvider>,
  );
}

/** Duas paradas: o toque seguinte sempre desfaz o anterior. */
test('o botão alterna entre os dois modos', async () => {
  const user = userEvent.setup();

  abrirBotao();

  expect(document.documentElement.getAttribute('data-theme')).toBe('light');

  await user.click(screen.getByRole('button'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  await user.click(screen.getByRole('button'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

/**
 * O nome acessível diz o estado **e** o destino.
 *
 * É a resposta à objeção de sempre contra um botão que troca sozinho: sem
 * dizer para onde vai, o próximo toque é um chute.
 */
test('o botão anuncia o tema atual e para onde vai', async () => {
  const user = userEvent.setup();

  abrirBotao();

  expect(screen.getByRole('button', { name: /tema: claro\. trocar para escuro/i }));

  await user.click(screen.getByRole('button'));

  expect(screen.getByRole('button', { name: /tema: escuro\. trocar para claro/i }));
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

  await user.click(screen.getByRole('button', { name: /trocar para escuro/i }));

  expect(screen.getByRole('radio', { name: /tema escuro/i })).toHaveProperty('checked', true);
});
