import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

/**
 * A guarda dos dois blocos de tema escuro.
 *
 * `tokens.css` declara o tema escuro duas vezes, e não por descuido: um
 * bloco responde a `prefers-color-scheme` para quem não escolheu nada, e o
 * outro responde ao `data-theme="dark"` de quem escolheu. CSS não permite
 * juntar os dois numa regra só — um esta dentro de um `@media` e o outro
 * não.
 *
 * O defeito que isto previne e silencioso. Quem edita um dos blocos esta
 * sempre num dos dois casos, vê a mudanca funcionar na própria tela e segue
 * em frente; quem esta no outro caso recebe metade do tema. Não há erro de
 * compilação, não há aviso, e a revisão de código lê duas listas de cor
 * parecidas sem notar a linha diferente.
 */

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** As declarações de um bloco, na ordem, sem comentário nem espaço a toa. */
function declaracoesDe(trecho: string): string[] {
  return trecho
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((linha) => linha.replace(/\s+/g, ' ').trim())
    .filter((linha) => linha.length > 0);
}

/** O corpo da regra que começa em `abertura`, contando as chaves. */
function corpoDaRegra(fonte: string, abertura: string): string {
  const inicio = fonte.indexOf(abertura);

  expect(inicio, `não achei a regra "${abertura}" em tokens.css`).toBeGreaterThan(-1);

  let profundidade = 0;
  let posicao = inicio + abertura.length - 1;

  for (let i = posicao; i < fonte.length; i += 1) {
    if (fonte[i] === '{') {
      profundidade += 1;
    }

    if (fonte[i] === '}') {
      profundidade -= 1;

      if (profundidade === 0) {
        return fonte.slice(posicao + 1, i);
      }
    }
  }

  throw new Error(`a regra "${abertura}" não fecha`);
}

test('os dois blocos de tema escuro declaram exatamente a mesma coisa', () => {
  const porMedia = declaracoesDe(corpoDaRegra(css, ":root:not([data-theme='light']) {"));
  const porAtributo = declaracoesDe(corpoDaRegra(css, ":root[data-theme='dark'] {"));

  expect(porMedia.length).toBeGreaterThan(10);
  expect(porAtributo).toEqual(porMedia);
});

/**
 * O tema escuro não pode esquecer `color-scheme`.
 *
 * E o que pinta a barra de rolagem, o cursor de texto e o menu do `<select>`
 * — superficies que nenhuma folha nossa alcança. Sem ele o tema sai com uma
 * barra de rolagem branca do lado da página preta.
 */
test('os dois blocos escuros declaram color-scheme', () => {
  const porMedia = corpoDaRegra(css, ":root:not([data-theme='light']) {");
  const porAtributo = corpoDaRegra(css, ":root[data-theme='dark'] {");

  expect(porMedia).toContain('color-scheme: dark');
  expect(porAtributo).toContain('color-scheme: dark');
});

/**
 * A laje continua escura nos dois temas.
 *
 * `--slab` existe para isso: o rodapé, a barra de avisos e a sidebar do
 * painel não podem ser pintados com `--ink`, que inverte. Se alguém apontar
 * a laje para o primeiro plano de novo, o tema escuro ganha um bloco claro
 * de ponta a ponta no pé da página.
 */
test('a laje não e o primeiro plano', () => {
  const claro = corpoDaRegra(css, ':root {');

  expect(claro).toMatch(/--slab:\s*#0e0e0e/);
  expect(claro).not.toMatch(/--slab:\s*var\(--ink\)/);

  const escuro = corpoDaRegra(css, ":root[data-theme='dark'] {");

  // No escuro a laje e um degrau acima do fundo (#0b0b0b), e não o claro.
  expect(escuro).toMatch(/--slab:\s*#16130e/);
});

/**
 * Os apelidos continuam apontando para os tokens de fundo.
 *
 * `--cream` e `--sand` estão escritos em dezenas de folhas. Escritos como
 * `var(--bg)`, eles acompanham o tema sozinhos; se alguém voltar a fixar o
 * hexadecimal neles, o tema escuro para de valer para tudo o que os usa — e
 * o que os usa e quase tudo.
 */
test('os apelidos de fundo seguem os tokens de tema', () => {
  const claro = corpoDaRegra(css, ':root {');

  expect(claro).toMatch(/--cream:\s*var\(--bg\)/);
  expect(claro).toMatch(/--sand:\s*var\(--bg-alt\)/);
});
