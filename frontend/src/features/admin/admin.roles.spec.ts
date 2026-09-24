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

test('o STAFF alcanca o início e os pedidos, e mais nada', () => {
  expect(areasFor(USER_ROLES.STAFF)).toEqual(['home', 'orders']);
});

test('o gerente alcanca a loja, menos configurações e sistema', () => {
  // As duas que sobram sao as que nao pertencem ao dia de vender: a area de
  // sistema e a moldura da loja, que se acerta uma vez na implantacao.
  expect(areasFor(USER_ROLES.OWNER)).toEqual(
    ADMIN_AREAS.filter((area) => area !== 'settings' && area !== 'system'),
  );
});

test('só o administrador do sistema alcanca todas as áreas', () => {
  expect(areasFor(USER_ROLES.SUPER_ADMIN)).toEqual([...ADMIN_AREAS]);
});

test('sem papel nenhum, nada se abre', () => {
  // O caso de quem tem token guardado e ainda nao carregou o usuario: a tela
  // desenha sem menu, e nao com o menu inteiro por um instante.
  expect(areasFor(undefined)).toEqual([]);
  expect(canSee(undefined, 'home')).toBe(false);
});

test('o STAFF não vê preço', () => {
  expect(canSeePrices(USER_ROLES.STAFF)).toBe(false);
  expect(canSeePrices(USER_ROLES.OWNER)).toBe(true);
  expect(canSeePrices(USER_ROLES.SUPER_ADMIN)).toBe(true);
});

test('o STAFF não escreve no catalogo, e o gerente escreve', () => {
  // `canManageStore` continua valendo para catalogo, entrega e pagamento — o
  // que saiu dele foram as configuracoes, que agora passam por `canSee`.
  expect(canManageStore(USER_ROLES.STAFF)).toBe(false);
  expect(canManageStore(USER_ROLES.OWNER)).toBe(true);
});

test('o catalogo e a entrega ficam fechados para o STAFF', () => {
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
 * SUPER_ADMIN abre e o que o gerente nao abre. Um `!==` invertido aqui poria
 * a criacao de usuarios nas maos de quem nao deve te-la.
 */

test('o item Sistema só existe para o administrador do sistema', () => {
  expect(canSee(USER_ROLES.SUPER_ADMIN, 'system')).toBe(true);
  expect(canSee(USER_ROLES.OWNER, 'system')).toBe(false);
  expect(canSee(USER_ROLES.STAFF, 'system')).toBe(false);
  expect(canSee(undefined, 'system')).toBe(false);
});

test('Configurações só existe para o administrador do sistema', () => {
  // Nao e area de atendimento nem de operacao: o numero para onde vai todo
  // pedido e o carrossel da home nao se mudam no dia a dia de vender.
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
