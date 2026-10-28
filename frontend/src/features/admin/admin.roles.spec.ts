import { expect, test } from 'vitest';
import { USER_ROLES } from '@/features/auth';
import {
  ADMIN_AREAS,
  areasFor,
  canDeleteForever,
  canEditStoreFrame,
  canManageStore,
  canManageSystem,
  canSee,
  canSeePrices,
} from './admin.roles';

/**
 * O recorte por papel.
 *
 * E a regra que o critério de aceite cobra — "STAFF não consegue ver nem
 * alterar preço" — e ela vale em três lugares da tela ao mesmo tempo: o
 * menu, o guarda de rota e as colunas de dinheiro. Um caso para cada
 * resposta, porque um `!==` invertido aqui abriria a margem da loja para
 * quem só deveria atender.
 */

test('o STAFF alcança o início e os pedidos, e mais nada', () => {
  expect(areasFor(USER_ROLES.STAFF)).toEqual(['home', 'orders']);
});

test('o gerente alcança a loja toda, menos a área de sistema', () => {
  // Configurações entra: e lá que mora o horário de atendimento, a barra de
  // avisos e a retirada na loja. O que naquela tela não e dele e recortado
  // por campo — ver `canEditStoreFrame` —, e não escondendo a área.
  expect(areasFor(USER_ROLES.OWNER)).toEqual(ADMIN_AREAS.filter((area) => area !== 'system'));
});

test('só o administrador do sistema alcança todas as áreas', () => {
  expect(areasFor(USER_ROLES.SUPER_ADMIN)).toEqual([...ADMIN_AREAS]);
});

test('sem papel nenhum, nada se abre', () => {
  // O caso de quem tem token guardado e ainda não carregou o usuário: a tela
  // desenha sem menu, e não com o menu inteiro por um instante.
  expect(areasFor(undefined)).toEqual([]);
  expect(canSee(undefined, 'home')).toBe(false);
});

test('o STAFF não vê preço', () => {
  expect(canSeePrices(USER_ROLES.STAFF)).toBe(false);
  expect(canSeePrices(USER_ROLES.OWNER)).toBe(true);
  expect(canSeePrices(USER_ROLES.SUPER_ADMIN)).toBe(true);
});

test('o STAFF não escreve no catálogo, e o gerente escreve', () => {
  expect(canManageStore(USER_ROLES.STAFF)).toBe(false);
  expect(canManageStore(USER_ROLES.OWNER)).toBe(true);
});

test('o catálogo e a entrega ficam fechados para o STAFF', () => {
  expect(canSee(USER_ROLES.STAFF, 'products')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'settings')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'delivery')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'orders')).toBe(true);
});

/**
 * A área de sistema.
 *
 * O critério de aceite e negativo — "o OWNER não enxerga o item Sistema nem
 * acessa a rota" — e por isso os casos são escritos dos dois lados: o que o
 * SUPER_ADMIN abre e o que o gerente não abre. Um `!==` invertido aqui poria
 * a criação de usuários nas mãos de quem não deve te-lá.
 */

test('o item Sistema só existe para o administrador do sistema', () => {
  expect(canSee(USER_ROLES.SUPER_ADMIN, 'system')).toBe(true);
  expect(canSee(USER_ROLES.OWNER, 'system')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'system')).toBe(false);
  expect(canSee(undefined, 'system')).toBe(false);
});

test('Configurações abre para o gerente, e não para o atendimento', () => {
  expect(canSee(USER_ROLES.SUPER_ADMIN, 'settings')).toBe(true);
  expect(canSee(USER_ROLES.OWNER, 'settings')).toBe(true);
  expect(canSee(USER_ROLES.STAFF, 'settings')).toBe(false);
});

test('o menu do gerente termina em Configurações', () => {
  const areas = areasFor(USER_ROLES.OWNER);

  expect(areas).not.toContain('system');
  expect(areas.at(-1)).toBe('settings');
});

/**
 * O que o gerente não desfaz, e o que ele não emoldura.
 *
 * Os dois recortes são escritos dos dois lados de propósito. Um `===`
 * trocado por `!==` em `canDeleteForever` poria a exclusão definitiva de
 * produto no menu de quem opera a loja às pressas, e a tela não tem como
 * avisar: o servidor recusaria depois, com um erro que ninguém pediu.
 */

test('excluir para sempre e só do administrador', () => {
  expect(canDeleteForever(USER_ROLES.SUPER_ADMIN)).toBe(true);
  expect(canDeleteForever(USER_ROLES.OWNER)).toBe(false);
  expect(canDeleteForever(USER_ROLES.STAFF)).toBe(false);
  expect(canDeleteForever(undefined)).toBe(false);
});

test('a moldura da loja dentro de Configurações e só do administrador', () => {
  // O gerente abre a área (`canSee`) e grava a operação; o carrossel, o
  // perfume da vez, as páginas do rodapé e as redes sociais, não.
  expect(canEditStoreFrame(USER_ROLES.SUPER_ADMIN)).toBe(true);
  expect(canEditStoreFrame(USER_ROLES.OWNER)).toBe(false);
  expect(canEditStoreFrame(USER_ROLES.STAFF)).toBe(false);
  expect(canEditStoreFrame(undefined)).toBe(false);
});

test('canManageSystem responde o mesmo que a área', () => {
  expect(canManageSystem(USER_ROLES.SUPER_ADMIN)).toBe(true);
  expect(canManageSystem(USER_ROLES.OWNER)).toBe(false);
  expect(canManageSystem(USER_ROLES.STAFF)).toBe(false);
  expect(canManageSystem(undefined)).toBe(false);
});
