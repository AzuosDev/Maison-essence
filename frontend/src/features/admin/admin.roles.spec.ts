import { expect, test } from 'vitest';
import { USER_ROLES } from '@/features/auth';
import {
  ADMIN_AREAS,
  areasFor,
  canManageStore,
  canManageSystem,
  canSee,
  canSeePrices,
} from './admin.roles';

/**
 * O recorte por papel.
 *
 * E a regra que o criterio de aceite cobra — "STAFF nao consegue ver nem
 * alterar preco" — e ela vale em tres lugares da tela ao mesmo tempo: o
 * menu, o guarda de rota e as colunas de dinheiro. Um caso para cada
 * resposta, porque um `!==` invertido aqui abriria a margem da loja para
 * quem so deveria atender.
 */

test('o STAFF alcanca o inicio e os pedidos, e mais nada', () => {
  expect(areasFor(USER_ROLES.STAFF)).toEqual(['home', 'orders']);
});

test('a dona alcanca a loja inteira, menos a area de sistema', () => {
  expect(areasFor(USER_ROLES.OWNER)).toEqual(ADMIN_AREAS.filter((area) => area !== 'system'));
});

test('so o administrador do sistema alcanca todas as areas', () => {
  expect(areasFor(USER_ROLES.SUPER_ADMIN)).toEqual([...ADMIN_AREAS]);
});

test('sem papel nenhum, nada se abre', () => {
  // O caso de quem tem token guardado e ainda nao carregou o usuario: a tela
  // desenha sem menu, e nao com o menu inteiro por um instante.
  expect(areasFor(undefined)).toEqual([]);
  expect(canSee(undefined, 'home')).toBe(false);
});

test('o STAFF nao ve preco', () => {
  expect(canSeePrices(USER_ROLES.STAFF)).toBe(false);
  expect(canSeePrices(USER_ROLES.OWNER)).toBe(true);
  expect(canSeePrices(USER_ROLES.SUPER_ADMIN)).toBe(true);
});

test('o STAFF nao escreve no catalogo', () => {
  expect(canManageStore(USER_ROLES.STAFF)).toBe(false);
  expect(canManageStore(USER_ROLES.OWNER)).toBe(true);
});

test('o catalogo e as configuracoes ficam fechados para o STAFF', () => {
  expect(canSee(USER_ROLES.STAFF, 'products')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'settings')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'delivery')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'orders')).toBe(true);
});

/**
 * A area de sistema.
 *
 * O criterio de aceite e negativo — "o OWNER nao enxerga o item Sistema nem
 * acessa a rota" — e por isso os casos sao escritos dos dois lados: o que o
 * SUPER_ADMIN abre e o que a dona nao abre. Um `!==` invertido aqui poria a
 * criacao de usuarios nas maos de quem nao deve te-la.
 */

test('o item Sistema so existe para o administrador do sistema', () => {
  expect(canSee(USER_ROLES.SUPER_ADMIN, 'system')).toBe(true);
  expect(canSee(USER_ROLES.OWNER, 'system')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'system')).toBe(false);
  expect(canSee(undefined, 'system')).toBe(false);
});

test('o menu da dona termina em Configuracoes', () => {
  const areas = areasFor(USER_ROLES.OWNER);

  expect(areas).not.toContain('system');
  expect(areas.at(-1)).toBe('settings');
});

test('canManageSystem responde o mesmo que a area', () => {
  expect(canManageSystem(USER_ROLES.SUPER_ADMIN)).toBe(true);
  expect(canManageSystem(USER_ROLES.OWNER)).toBe(false);
  expect(canManageSystem(USER_ROLES.STAFF)).toBe(false);
  expect(canManageSystem(undefined)).toBe(false);
});
