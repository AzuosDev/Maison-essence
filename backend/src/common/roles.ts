import type { UserRole } from './enums/user-role.js';
import { USER_ROLES } from './enums/user-role.js';

/**
 * A tabela de permissões do painel, em um lugar só.
 *
 * Cada conjunto e o argumento de um `@Roles(...)`. Ter os grupos nomeados aqui
 * — em vez de repetir listas de papéis pelos controllers — e o que mantem a
 * regra legível: mudar quem mexe em preço e editar uma linha deste arquivo, e
 * não cacar decorators pela árvore.
 *
 * `SUPER_ADMIN` não aparece em conjunto nenhum de propósito: o `RolesGuard`
 * sempre o libera.
 */

/**
 * Catálogo, preços, entrega e pagamento: o que se opera para vender.
 *
 * As configurações da loja não estão aqui. Elas subiram para o SUPER_ADMIN
 * (`@Roles(USER_ROLES.SUPER_ADMIN)` em `/admin/settings`) porque o que se muda
 * nelas e a moldura inteira — o número para onde vai todo pedido, o carrossel
 * da home, as páginas do rodapé —, e isso se acerta uma vez na implantação.
 */
export const MANAGES_STORE: readonly UserRole[] = [USER_ROLES.OWNER];

/** Usuários administrativos. O OWNER só alcança os STAFF (ver a policy). */
export const MANAGES_USERS: readonly UserRole[] = [USER_ROLES.OWNER];

/** Leitura de pedidos e atualização de status. O STAFF entra aqui. */
export const HANDLES_ORDERS: readonly UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.STAFF,
];

/** Leitura do catálogo pelo painel. */
export const READS_CATALOG: readonly UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.STAFF,
];
