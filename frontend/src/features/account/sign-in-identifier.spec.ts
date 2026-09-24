import { expect, test } from 'vitest';
import { maskIdentifier, resolveIdentifier } from './sign-in-identifier';

/**
 * O campo único da entrada.
 *
 * O que importa aqui não e a máscara: e que nada do que foi digitado se
 * perca no caminho entre a tecla e o envio. Um digito comido pela máscara
 * não vira "senha errada" — vira uma pessoa que jura ter digitado certo.
 */

/* ---- Quem e quem ----------------------------------------------------------- */

test('onze digitos são o celular, com ou sem pontuação', () => {
  expect(resolveIdentifier('88999998888')).toEqual({ kind: 'phone', phone: '88999998888' });
  expect(resolveIdentifier('(88) 99999-8888')).toEqual({ kind: 'phone', phone: '88999998888' });
});

/** Quem cola de um contato salvo traz o pais junto, e o número continua valendo. */
test('o código do pais colado junto não inválida o número', () => {
  expect(resolveIdentifier('+55 (88) 99999-8888')).toEqual({
    kind: 'phone',
    phone: '88999998888',
  });
});

test('o e-mail entra em minúsculas, aparado', () => {
  expect(resolveIdentifier('  Dona@Loja.COM  ')).toEqual({ kind: 'email', email: 'dona@loja.com' });
});

/**
 * A arroba decide antes do telefone.
 *
 * `88999998888@` tem onze digitos e seria um celular perfeito se a arroba
 * fosse ignorada. Quem escreveu aquilo estava digitando um e-mail e parou no
 * meio: mandar o número para o login de cliente devolveria "celular ou senha
 * não conferem" a quem só não terminou o domínio.
 */
test('havendo arroba, só resta e-mail — mesmo com onze digitos antes dela', () => {
  expect(resolveIdentifier('88999998888@')).toBeNull();
});

test('o que não e nenhum dos dois não vira nenhum dos dois', () => {
  expect(resolveIdentifier('')).toBeNull();
  expect(resolveIdentifier('maria')).toBeNull();
  expect(resolveIdentifier('99999')).toBeNull();

  // Fixo, e não celular: o nono digito e o que o cadastro exige.
  expect(resolveIdentifier('8833334444')).toBeNull();
});

/* ---- A máscara, tecla a tecla ---------------------------------------------- */

/** Digitar o número inteiro, um caractere por vez, como o campo faz. */
function digitar(texto: string): string {
  return [...texto].reduce((campo, tecla) => maskIdentifier(campo + tecla), '');
}

test('o número ganha parênteses e hífen enquanto e digitado', () => {
  expect(digitar('88999998888')).toBe('(88) 99999-8888');
});

/**
 * O caso que justifica o desmonte a cada tecla.
 *
 * Um e-mail que começa com números e indistinguível de um telefone até a
 * arroba. Sem desfazer a máscara ali, o campo guardaria `(12) 3456@...` e o
 * e-mail sairia com parênteses dentro.
 */
test('o e-mail que começa com números perde a máscara na arroba, sem perder digito', () => {
  expect(digitar('123456@loja.com')).toBe('123456@loja.com');
});

test('o hífen de um e-mail não e confundido com o hífen da máscara', () => {
  expect(digitar('maria-silva@loja.com')).toBe('maria-silva@loja.com');
});

/**
 * Colar o número com o pais não pode custar um digito.
 *
 * A máscara de telefone corta nos onze primeiros: `5588999998888` viraria
 * `(55) 88999-9988`. Acima de onze digitos ela sai de cena, e quem resolve e
 * `normalizePhone`, que sabe tirar o `55`.
 */
test('treze digitos colados passam inteiros, e ainda resolvem em celular', () => {
  const colado = maskIdentifier('5588999998888');

  expect(colado).toBe('5588999998888');
  expect(resolveIdentifier(colado)).toEqual({ kind: 'phone', phone: '88999998888' });
});

test('o que já esta mascarado continua igual ao passar de novo', () => {
  expect(maskIdentifier('(88) 99999-8888')).toBe('(88) 99999-8888');
});
