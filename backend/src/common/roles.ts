import type { UserRole } from './enums/user-role.js';
import { USER_ROLES } from './enums/user-role.js';

/**
 * A tabela de permissoes do painel, em um lugar so.
 *
 * Cada conjunto e o argumento de um `@Roles(...)`. Ter os grupos nomeados aqui
 * — em vez de repetir listas de papeis pelos controllers — e o que mantem a
 * regra legivel: mudar quem mexe em preco e editar uma linha deste arquivo, e
 * nao cacar decorators pela arvore.
 *
 * `SUPER_ADMIN` nao aparece em conjunto nenhum de proposito: o `RolesGuard`
 * sempre o libera.
 */

/** Catalogo, precos, entrega, pagamento e configuracoes da loja. */
export const MANAGES_STORE: readonly UserRole[] = [USER_ROLES.OWNER];

/** Usuarios administrativos. O OWNER so alcanca os STAFF (ver a policy). */
export const MANAGES_USERS: readonly UserRole[] = [USER_ROLES.OWNER];

/** Leitura de pedidos e atualizacao de status. O STAFF entra aqui. */
export const HANDLES_ORDERS: readonly UserRole[] = [USER_ROLES.OWNER, USER_ROLES.STAFF];

/** Leitura do catalogo pelo painel. */
export const READS_CATALOG: readonly UserRole[] = [USER_ROLES.OWNER, USER_ROLES.STAFF];
