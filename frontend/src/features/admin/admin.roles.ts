import { USER_ROLES, type UserRole } from '@/features/auth';

/**
 * Quem ve o que, no painel.
 *
 * Tres papeis e uma regra que nao pode morar espalhada pelas telas:
 *
 * - **SUPER_ADMIN** e **OWNER** operam a loja inteira.
 * - **STAFF** atende pedidos. Ve o Inicio e os Pedidos, e nada mais — nem
 *   cadastro, nem taxas, nem configuracao. E **nao ve preco**: nem para
 *   conferir, nem para editar.
 *
 * O preco escondido do STAFF nao e tecnicismo de permissao: e a razao de o
 * papel existir. Quem ajuda a atender no WhatsApp precisa saber o que o
 * cliente pediu e para onde vai, sem ter acesso a margem da loja.
 *
 * ## Onde esta regra vale
 *
 * Aqui, e em tres lugares que consultam este arquivo: o menu (que nao
 * desenha o que a pessoa nao pode abrir), o guarda de rota (que recusa o
 * endereco digitado a mao) e as telas de pedido (que escondem as colunas de
 * dinheiro). O backend recusa por conta propria — `@Roles(...)` em cada
 * controlador —, e por isso o painel pode se dar ao luxo de esconder em vez
 * de tentar impedir: o que passar daqui morre no servidor.
 */

/** As areas do painel, na ordem em que o menu as lista. */
export const ADMIN_AREAS = [
  'home',
  'products',
  'categories',
  'readyToShip',
  'orders',
  'delivery',
  'payments',
  'settings',
] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number];

/** O que o STAFF alcanca. Todo o resto do painel e de quem administra. */
const STAFF_AREAS = new Set<AdminArea>(['home', 'orders']);

export function canSee(role: UserRole | undefined, area: AdminArea): boolean {
  if (role === undefined) {
    return false;
  }

  return role === USER_ROLES.STAFF ? STAFF_AREAS.has(area) : true;
}

/** As areas que este papel abre, na ordem do menu. */
export function areasFor(role: UserRole | undefined): AdminArea[] {
  return ADMIN_AREAS.filter((area) => canSee(role, area));
}

/**
 * O papel enxerga dinheiro.
 *
 * Vale para o preco do produto, o total do pedido, o faturamento do mes e a
 * taxa de entrega — tudo o que responde "quanto". O STAFF ve o pedido
 * inteiro sem os valores.
 */
export function canSeePrices(role: UserRole | undefined): boolean {
  return role !== undefined && role !== USER_ROLES.STAFF;
}

/** O papel escreve no catalogo e nas configuracoes. */
export function canManageStore(role: UserRole | undefined): boolean {
  return role !== undefined && role !== USER_ROLES.STAFF;
}

/** O papel mexe em pedido: mudar status, anotar, cancelar. */
export function canHandleOrders(role: UserRole | undefined): boolean {
  return role !== undefined;
}

/** Como o papel aparece escrito na tela. */
export const ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.SUPER_ADMIN]: 'Administrador',
  [USER_ROLES.OWNER]: 'Dona da loja',
  [USER_ROLES.STAFF]: 'Atendimento',
};
