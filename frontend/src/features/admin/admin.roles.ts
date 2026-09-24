import { USER_ROLES, type UserRole } from '@/features/auth';

/**
 * Quem vê o que, no painel.
 *
 * Três papéis e uma regra que não pode morar espalhada pelas telas:
 *
 * - **SUPER_ADMIN** alcança tudo, inclusive o que só se configura uma vez:
 *   as configurações da loja e a área de sistema.
 * - **OWNER** opera a loja: catálogo, pedidos, entrega e pagamento. E o dia a
 *   dia de vender, e e tudo o que ele precisa para isso.
 * - **STAFF** atende pedidos. Vê o Início e os Pedidos, e nada mais — nem
 *   cadastro, nem taxas, nem configuração. E **não vê preço**: nem para
 *   conferir, nem para editar.
 *
 * O preço escondido do STAFF não e tecnicismo de permissão: e a razão de o
 * papel existir. Quem ajuda a atender no WhatsApp precisa saber o que o
 * cliente pediu e para onde vai, sem ter acesso a margem da loja.
 *
 * ## Onde esta regra vale
 *
 * Aqui, e em três lugares que consultam este arquivo: o menu (que não
 * desenha o que a pessoa não pode abrir), o guarda de rota (que recusa o
 * endereço digitado a mão) e as telas de pedido (que escondem as colunas de
 * dinheiro). O backend recusa por conta própria — `@Roles(...)` em cada
 * controlador —, e por isso o painel pode se dar ao luxo de esconder em vez
 * de tentar impedir: o que passar daqui morre no servidor.
 */

/** As áreas do painel, na ordem em que o menu as lista. */
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
   * A área de sistema: usuários, auditoria, saúde.
   *
   * Última da lista e separada por um divisor no menu, porque não e uma
   * área da loja — e a manutenção do próprio painel. A dona nunca precisa
   * dela para vender.
   */
  'system',
] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number];

/** O que o STAFF alcança. Todo o resto do painel e de quem administra. */
const STAFF_AREAS = new Set<AdminArea>(['home', 'orders']);

/**
 * O que só o SUPER_ADMIN alcança.
 *
 * Duas áreas, por duas razões diferentes.
 *
 * **Sistema** não e área da loja: criar usuário, ler a trilha de auditoria e
 * conferir a saúde do servidor são tarefas de quem mantem a aplicação, e
 * deixa-las a vista de quem opera só cria a chance de alguém se desativar
 * sozinho numa tarde movimentada.
 *
 * **Configurações** e área da loja, e mesmo assim esta aqui. O que se muda
 * nela não e um produto: e a moldura inteira — o número para onde vai todo
 * pedido, o que a home mostra primeiro, as páginas que o rodapé lista. São
 * decisões de implantação, tomadas uma vez com quem mantem o sistema, e não
 * escolhas do dia de vender. O backend também as fechou (`@Roles(SUPER_ADMIN)`
 * em `/admin/settings`), então aqui não há divergência: o item some do menu
 * e a rota morre no servidor.
 *
 * Vale registrar uma divergência que existe: `/users` aceita o OWNER
 * (`MANAGES_USERS = [OWNER]`, e o SUPER_ADMIN passa pelo guard), com uma
 * policy que limita o alcance dele aos STAFF. O painel e mais restrito do
 * que o servidor de propósito — esconder aqui não afrouxa nada lá.
 */
const SUPER_ADMIN_AREAS = new Set<AdminArea>(['settings', 'system']);

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
 * Um atalho com nome, para as telas que perguntam isso sem falar de área:
 * o guarda de `/admin/system`, a tela de acesso negado e o divisor do menu.
 */
export function canManageSystem(role: UserRole | undefined): boolean {
  return role === USER_ROLES.SUPER_ADMIN;
}

/** As áreas que este papel abre, na ordem do menu. */
export function areasFor(role: UserRole | undefined): AdminArea[] {
  return ADMIN_AREAS.filter((area) => canSee(role, area));
}

/**
 * O papel enxerga dinheiro.
 *
 * Vale para o preço do produto, o total do pedido, o faturamento do mês e a
 * taxa de entrega — tudo o que responde "quanto". O STAFF vê o pedido
 * inteiro sem os valores.
 */
export function canSeePrices(role: UserRole | undefined): boolean {
  return role !== undefined && role !== USER_ROLES.STAFF;
}

/**
 * O papel escreve na loja: catálogo, categorias, entrega e pagamento.
 *
 * Não responde pelas configurações, que subiram para o SUPER_ADMIN — quem
 * pergunta por elas usa `canSee(role, 'settings')`, que lê a tabela de áreas
 * em vez de repetir a regra.
 */
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
  [USER_ROLES.OWNER]: 'Gerente da loja',
  [USER_ROLES.STAFF]: 'Atendimento',
};
