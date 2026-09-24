import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

/**
 * A moldura da conta, lida no arquivo de estilo.
 *
 * Nenhum ambiente de teste deste projeto calcula CSS — o jsdom nao resolve
 * `grid-template-columns` e nao mede nada —, entao a regra que importa aqui
 * so pode ser conferida no texto. Vale o incomodo por causa do defeito que
 * ela consertou: sem sessao, a moldura nao desenha o menu lateral, e o
 * `grid-template-columns: 15rem 1fr` incondicional espremia entrar, criar
 * conta e o convite nos 240px da coluna do menu — encostados a esquerda,
 * com metade da pagina vazia ao lado. Nao havia teste que percebesse, e nao
 * ha como haver: o DOM estava certo o tempo todo.
 */

const css = readFileSync(fileURLToPath(new URL('./account-layout.module.css', import.meta.url)), {
  encoding: 'utf8',
});

/** As declaracoes de uma regra, pelo seletor. */
function regra(seletor: string): string | null {
  const encontrada = new RegExp(
    `(?:^|\\})\\s*${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  ).exec(css);

  return encontrada?.[1] ?? null;
}

test('as duas colunas só valem quando há um menu para por na primeira', () => {
  expect(regra('.body:has(> .aside)')).toContain('grid-template-columns: 15rem 1fr');
});

/**
 * O contraponto do caso acima, e o que de fato quebra se alguem desfizer a
 * correcao: `.body` sozinho nao pode voltar a declarar as duas colunas.
 */
test('o .body sozinho não declara coluna nenhuma', () => {
  const corpo = regra('.body');

  expect(corpo).not.toBeNull();
  expect(corpo).toContain('display: grid');
  expect(corpo).not.toContain('grid-template-columns');
});
