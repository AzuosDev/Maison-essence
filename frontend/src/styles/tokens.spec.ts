import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

/**
 * A guarda dos dois blocos de tema escuro.
 *
 * `tokens.css` declara o tema escuro duas vezes, e nao por descuido: um
 * bloco responde a `prefers-color-scheme` para quem nao escolheu nada, e o
 * outro responde ao `data-theme="dark"` de quem escolheu. CSS nao permite
 * juntar os dois numa regra so — um esta dentro de um `@media` e o outro
 * nao.
 *
 * O defeito que isto previne e silencioso. Quem edita um dos blocos esta
 * sempre num dos dois casos, ve a mudanca funcionar na propria tela e segue
 * em frente; quem esta no outro caso recebe metade do tema. Nao ha erro de
 * compilacao, nao ha aviso, e a revisao de codigo le duas listas de cor
 * parecidas sem notar a linha diferente.
 */

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** As declaracoes de um bloco, na ordem, sem comentario nem espaco a toa. */
function declaracoesDe(trecho: string): string[] {
  return trecho
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((linha) => linha.replace(/\s+/g, ' ').trim())
    .filter((linha) => linha.length > 0);
}

/** O corpo da regra que comeca em `abertura`, contando as chaves. */
function corpoDaRegra(fonte: string, abertura: string): string {
  const inicio = fonte.indexOf(abertura);

  expect(inicio, `nao achei a regra "${abertura}" em tokens.css`).toBeGreaterThan(-1);

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

  throw new Error(`a regra "${abertura}" nao fecha`);
}

test('os dois blocos de tema escuro declaram exatamente a mesma coisa', () => {
  const porMedia = declaracoesDe(corpoDaRegra(css, ":root:not([data-theme='light']) {"));
  const porAtributo = declaracoesDe(corpoDaRegra(css, ":root[data-theme='dark'] {"));

  expect(porMedia.length).toBeGreaterThan(10);
  expect(porAtributo).toEqual(porMedia);
});

/**
 * O tema escuro nao pode esquecer `color-scheme`.
 *
 * E o que pinta a barra de rolagem, o cursor de texto e o menu do `<select>`
 * — superficies que nenhuma folha nossa alcanca. Sem ele o tema sai com uma
 * barra de rolagem branca do lado da pagina preta.
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
 * `--slab` existe para isso: o rodape, a barra de avisos e a sidebar do
 * painel nao podem ser pintados com `--ink`, que inverte. Se alguem apontar
 * a laje para o primeiro plano de novo, o tema escuro ganha um bloco claro
 * de ponta a ponta no pe da pagina.
 */
test('a laje nao e o primeiro plano', () => {
  const claro = corpoDaRegra(css, ':root {');

  expect(claro).toMatch(/--slab:\s*#0e0e0e/);
  expect(claro).not.toMatch(/--slab:\s*var\(--ink\)/);

  const escuro = corpoDaRegra(css, ":root[data-theme='dark'] {");

  // No escuro a laje e um degrau acima do fundo (#0b0b0b), e nao o claro.
  expect(escuro).toMatch(/--slab:\s*#16130e/);
});

/**
 * Os apelidos continuam apontando para os tokens de fundo.
 *
 * `--cream` e `--sand` estao escritos em dezenas de folhas. Escritos como
 * `var(--bg)`, eles acompanham o tema sozinhos; se alguem voltar a fixar o
 * hexadecimal neles, o tema escuro para de valer para tudo o que os usa — e
 * o que os usa e quase tudo.
 */
test('os apelidos de fundo seguem os tokens de tema', () => {
  const claro = corpoDaRegra(css, ':root {');

  expect(claro).toMatch(/--cream:\s*var\(--bg\)/);
  expect(claro).toMatch(/--sand:\s*var\(--bg-alt\)/);
});
