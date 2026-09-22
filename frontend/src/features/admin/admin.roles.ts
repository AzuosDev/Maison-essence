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

  /**
   * A area de sistema: usuarios, auditoria, saude.
   *
   * Ultima da lista e separada por um divisor no menu, porque nao e uma
   * area da loja — e a manutencao do proprio painel. A dona nunca precisa
   * dela para vender.
   */
  'system',
] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number];

/** O que o STAFF alcanca. Todo o resto do painel e de quem administra. */
const STAFF_AREAS = new Set<AdminArea>(['home', 'orders']);

/**
 * O que so o SUPER_ADMIN alcanca.
 *
 * A dona administra a loja inteira; quem administra o **sistema** e outra
 * pessoa. Criar usuario, ler a trilha de auditoria e conferir a saude do
 * servidor sao tarefas de quem mantem a aplicacao, e deixa-las a vista do
 * OWNER so cria a chance de alguem se desativar sozinho numa tarde movimentada.
 *
 * Vale registrar uma divergencia com o backend: `/users` aceita o OWNER
 * (`MANAGES_USERS = [OWNER]`, e o SUPER_ADMIN passa pelo guard), com uma
 * policy que limita o alcance dele aos STAFF. O painel e mais restrito do
 * que o servidor de proposito — esconder aqui nao afrouxa nada la.
 */
const SUPER_ADMIN_AREAS = new Set<AdminArea>(['system']);

export function canSee(role: UserRole | undefined, area: AdminArea): boolean {
  if (role === undefined) {
    return false;
  }

  if (SUPER_ADMIN_AREAS.has(area)) {
    return role === USER_ROLES.SUPER_ADMIN;
  }

  return role === USER_ROLES.STAFF ? STAFF_AREAS.has(area) : true;
}

/**
 * O papel administra o sistema.
 *
 * Um atalho com nome, para as telas que perguntam isso sem falar de area:
 * o guarda de `/admin/system`, a tela de acesso negado e o divisor do menu.
 */
export function canManageSystem(role: UserRole | undefined): boolean {
  return role === USER_ROLES.SUPER_ADMIN;
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
