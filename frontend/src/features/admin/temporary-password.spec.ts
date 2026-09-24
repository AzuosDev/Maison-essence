import { expect, test } from 'vitest';
import { TEMPORARY_PASSWORD_LENGTH, generateTemporaryPassword } from './temporary-password';

/**
 * A senha do primeiro acesso.
 *
 * Três coisas precisam continuar verdadeiras, e as três tem consequência
 * fora do teste: o comprimento (a API recusa abaixo de doze), o alfabeto (a
 * senha e lida em voz alta) e o fato de cada chamada devolver uma senha
 * diferente — o erro que uma implementação com semente fixa cometeria sem
 * nunca falhar em nada mais.
 */

test('tem dezesseis caracteres, como a que o backend gera no reset', () => {
  expect(generateTemporaryPassword()).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
  expect(TEMPORARY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
});

test('não usa os caracteres que se confundem ao ler em voz alta', () => {
  // I, l, O, 0 e 1. A senha e passada por WhatsApp ou num bilhete.
  const senhas = Array.from({ length: 200 }, () => generateTemporaryPassword()).join('');

  expect(senhas).not.toMatch(/[Il0O1]/);
});

test('só usa letras e números', () => {
  expect(generateTemporaryPassword()).toMatch(/^[A-Za-z2-9]+$/);
});

test('cada chamada devolve uma senha diferente', () => {
  const senhas = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));

  expect(senhas.size).toBe(100);
});

test('aceita um comprimento maior quando alguém pedir', () => {
  expect(generateTemporaryPassword(24)).toHaveLength(24);
});
