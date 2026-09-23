import { expect, test } from 'vitest';
import { maskIdentifier, resolveIdentifier } from './sign-in-identifier';

/**
 * O campo unico da entrada.
 *
 * O que importa aqui nao e a mascara: e que nada do que foi digitado se
 * perca no caminho entre a tecla e o envio. Um digito comido pela mascara
 * nao vira "senha errada" — vira uma pessoa que jura ter digitado certo.
 */

/* ---- Quem e quem ----------------------------------------------------------- */

test('onze digitos sao o celular, com ou sem pontuacao', () => {
  expect(resolveIdentifier('88999998888')).toEqual({ kind: 'phone', phone: '88999998888' });
  expect(resolveIdentifier('(88) 99999-8888')).toEqual({ kind: 'phone', phone: '88999998888' });
});

/** Quem cola de um contato salvo traz o pais junto, e o numero continua valendo. */
test('o codigo do pais colado junto nao invalida o numero', () => {
  expect(resolveIdentifier('+55 (88) 99999-8888')).toEqual({
    kind: 'phone',
    phone: '88999998888',
  });
});

test('o e-mail entra em minusculas, aparado', () => {
  expect(resolveIdentifier('  Dona@Loja.COM  ')).toEqual({ kind: 'email', email: 'dona@loja.com' });
});

/**
 * A arroba decide antes do telefone.
 *
 * `88999998888@` tem onze digitos e seria um celular perfeito se a arroba
 * fosse ignorada. Quem escreveu aquilo estava digitando um e-mail e parou no
 * meio: mandar o numero para o login de cliente devolveria "celular ou senha
 * nao conferem" a quem so nao terminou o dominio.
 */
test('havendo arroba, so resta e-mail — mesmo com onze digitos antes dela', () => {
  expect(resolveIdentifier('88999998888@')).toBeNull();
});

test('o que nao e nenhum dos dois nao vira nenhum dos dois', () => {
  expect(resolveIdentifier('')).toBeNull();
  expect(resolveIdentifier('maria')).toBeNull();
  expect(resolveIdentifier('99999')).toBeNull();

  // Fixo, e nao celular: o nono digito e o que o cadastro exige.
  expect(resolveIdentifier('8833334444')).toBeNull();
});

/* ---- A mascara, tecla a tecla ---------------------------------------------- */

/** Digitar o numero inteiro, um caractere por vez, como o campo faz. */
function digitar(texto: string): string {
  return [...texto].reduce((campo, tecla) => maskIdentifier(campo + tecla), '');
}

test('o numero ganha parenteses e hifen enquanto e digitado', () => {
  expect(digitar('88999998888')).toBe('(88) 99999-8888');
});

/**
 * O caso que justifica o desmonte a cada tecla.
 *
 * Um e-mail que comeca com numeros e indistinguivel de um telefone ate a
 * arroba. Sem desfazer a mascara ali, o campo guardaria `(12) 3456@...` e o
 * e-mail sairia com parenteses dentro.
 */
test('o e-mail que comeca com numeros perde a mascara na arroba, sem perder digito', () => {
  expect(digitar('123456@loja.com')).toBe('123456@loja.com');
});

test('o hifen de um e-mail nao e confundido com o hifen da mascara', () => {
  expect(digitar('maria-silva@loja.com')).toBe('maria-silva@loja.com');
});

/**
 * Colar o numero com o pais nao pode custar um digito.
 *
 * A mascara de telefone corta nos onze primeiros: `5588999998888` viraria
 * `(55) 88999-9988`. Acima de onze digitos ela sai de cena, e quem resolve e
 * `normalizePhone`, que sabe tirar o `55`.
 */
test('treze digitos colados passam inteiros, e ainda resolvem em celular', () => {
  const colado = maskIdentifier('5588999998888');

  expect(colado).toBe('5588999998888');
  expect(resolveIdentifier(colado)).toEqual({ kind: 'phone', phone: '88999998888' });
});

test('o que ja esta mascarado continua igual ao passar de novo', () => {
  expect(maskIdentifier('(88) 99999-8888')).toBe('(88) 99999-8888');
});
