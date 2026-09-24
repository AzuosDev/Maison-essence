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

/**
 * Catalogo, precos, entrega e pagamento: o que se opera para vender.
 *
 * As configuracoes da loja nao estao aqui. Elas subiram para o SUPER_ADMIN
 * (`@Roles(USER_ROLES.SUPER_ADMIN)` em `/admin/settings`) porque o que se muda
 * nelas e a moldura inteira — o numero para onde vai todo pedido, o carrossel
 * da home, as paginas do rodape —, e isso se acerta uma vez na implantacao.
 */
export const MANAGES_STORE: readonly UserRole[] = [USER_ROLES.OWNER];

/** Usuarios administrativos. O OWNER so alcanca os STAFF (ver a policy). */
export const MANAGES_USERS: readonly UserRole[] = [USER_ROLES.OWNER];

/** Leitura de pedidos e atualizacao de status. O STAFF entra aqui. */
export const HANDLES_ORDERS: readonly UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.STAFF,
];

/** Leitura do catalogo pelo painel. */
export const READS_CATALOG: readonly UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.STAFF,
];
