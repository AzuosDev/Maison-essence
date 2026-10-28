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
 * sempre o libera. Por isso o que e só dele não ganha conjunto — leva
 * `@Roles(USER_ROLES.SUPER_ADMIN)` na própria rota, e são três famílias:
 *
 * - **a exclusão definitiva** de produto, categoria e cidade de entrega: o
 *   gerente desativa e despublica, que desfaz, e não apaga, que não desfaz;
 * - **os usuários do painel** (`/users`), para que ninguém se promova;
 * - **a moldura da loja**: os campos de `/admin/settings` que não são do dia a
 *   dia (ver `settings-access.policy.ts`), a importação de catálogo e a área
 *   de sistema.
 */

/**
 * Catálogo, preços, entrega, pagamento e as configurações do dia a dia: o que
 * se opera para vender.
 *
 * `/admin/settings` esta aqui, e não um degrau acima, porque o gerente precisa
 * corrigir sozinho o que muda no expediente — o horário de atendimento, a
 * barra de avisos, o número do WhatsApp, a retirada na loja. O que naquela
 * tela e moldura, e não operação, e recusado campo a campo dentro do PATCH.
 */
export const MANAGES_STORE: readonly UserRole[] = [USER_ROLES.OWNER];

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
