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
 * E a regra que o critério de aceite cobra — "STAFF não consegue ver nem
 * alterar preço" — e ela vale em três lugares da tela ao mesmo tempo: o
 * menu, o guarda de rota e as colunas de dinheiro. Um caso para cada
 * resposta, porque um `!==` invertido aqui abriria a margem da loja para
 * quem só deveria atender.
 */

test('o STAFF alcança o início e os pedidos, e mais nada', () => {
  expect(areasFor(USER_ROLES.STAFF)).toEqual(['home', 'orders']);
});

test('o gerente alcança a loja, menos configurações e sistema', () => {
  // As duas que sobram são as que não pertencem ao dia de vender: a área de
  // sistema e a moldura da loja, que se acerta uma vez na implantação.
  expect(areasFor(USER_ROLES.OWNER)).toEqual(
    ADMIN_AREAS.filter((area) => area !== 'settings' && area !== 'system'),
  );
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
  // `canManageStore` continua valendo para catálogo, entrega e pagamento — o
  // que saiu dele foram as configurações, que agora passam por `canSee`.
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

test('Configurações só existe para o administrador do sistema', () => {
  // Não e área de atendimento nem de operação: o número para onde vai todo
  // pedido e o carrossel da home não se mudam no dia a dia de vender.
  expect(canSee(USER_ROLES.SUPER_ADMIN, 'settings')).toBe(true);
  expect(canSee(USER_ROLES.OWNER, 'settings')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'settings')).toBe(false);
});

test('o menu do gerente termina em Pagamento', () => {
  const areas = areasFor(USER_ROLES.OWNER);

  expect(areas).not.toContain('system');
  expect(areas.at(-1)).toBe('payments');
});

test('canManageSystem responde o mesmo que a área', () => {
  expect(canManageSystem(USER_ROLES.SUPER_ADMIN)).toBe(true);
  expect(canManageSystem(USER_ROLES.OWNER)).toBe(false);
  expect(canManageSystem(USER_ROLES.STAFF)).toBe(false);
  expect(canManageSystem(undefined)).toBe(false);
});
