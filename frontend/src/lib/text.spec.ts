import { expect, test } from 'vitest';
import { foldAccents } from './text';

/**
 * A normalizacao de acentos.
 *
 * Existe um caso para cada coisa que a faixa `̀-ͯ` pode errar em
 * silencio. E facil escrever essa faixa de um jeito que continua compilando,
 * continua passando nos testes que so usam palavras sem acento, e devolve o
 * texto intocado — a busca simplesmente para de achar "Acqua" quando alguem
 * digita "acqua", e ninguem descobre ate um cliente reclamar.
 */

test('tira o acento e baixa a caixa', () => {
  expect(foldAccents('Àcqua di Gió')).toBe('acqua di gio');
});

test('cobre os acentos que aparecem em portugues', () => {
  expect(foldAccents('Ação Coração Único Pêssego Über')).toBe('acao coracao unico pessego uber');
});

test('mantem o comprimento do texto original', () => {
  // E disto que dependem os indices do realce da busca: a copia sem acento
  // precisa ter o mesmo tamanho para que o recorte caia no lugar certo.
  const original = 'Água de Colônia';

  expect(foldAccents(original)).toHaveLength(original.length);
});

test('nao come letra nenhuma no caminho', () => {
  // Uma faixa mal escrita — `[0300-036f]`, sem os escapes de codigo — remove
  // digitos e as letras de "a" a "f". Este e o caso que pega isso.
  expect(foldAccents('Oud 36 Facade')).toBe('oud 36 facade');
});

test('texto sem acento passa intocado', () => {
  expect(foldAccents('Lattafa')).toBe('lattafa');
});
