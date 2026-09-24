import { USER_ROLES, type UserRole } from '@/features/auth';

/**
 * Quem ve o que, no painel.
 *
 * Tres papeis e uma regra que nao pode morar espalhada pelas telas:
 *
 * - **SUPER_ADMIN** alcanca tudo, inclusive o que so se configura uma vez:
 *   as configuracoes da loja e a area de sistema.
 * - **OWNER** opera a loja: catalogo, pedidos, entrega e pagamento. E o dia a
 *   dia de vender, e e tudo o que ele precisa para isso.
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
 * Duas areas, por duas razoes diferentes.
 *
 * **Sistema** nao e area da loja: criar usuario, ler a trilha de auditoria e
 * conferir a saude do servidor sao tarefas de quem mantem a aplicacao, e
 * deixa-las a vista de quem opera so cria a chance de alguem se desativar
 * sozinho numa tarde movimentada.
 *
 * **Configuracoes** e area da loja, e mesmo assim esta aqui. O que se muda
 * nela nao e um produto: e a moldura inteira — o numero para onde vai todo
 * pedido, o que a home mostra primeiro, as paginas que o rodape lista. Sao
 * decisoes de implantacao, tomadas uma vez com quem mantem o sistema, e nao
 * escolhas do dia de vender. O backend tambem as fechou (`@Roles(SUPER_ADMIN)`
 * em `/admin/settings`), entao aqui nao ha divergencia: o item some do menu
 * e a rota morre no servidor.
 *
 * Vale registrar uma divergencia que existe: `/users` aceita o OWNER
 * (`MANAGES_USERS = [OWNER]`, e o SUPER_ADMIN passa pelo guard), com uma
 * policy que limita o alcance dele aos STAFF. O painel e mais restrito do
 * que o servidor de proposito — esconder aqui nao afrouxa nada la.
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

/**
 * O papel escreve na loja: catalogo, categorias, entrega e pagamento.
 *
 * Nao responde pelas configuracoes, que subiram para o SUPER_ADMIN — quem
 * pergunta por elas usa `canSee(role, 'settings')`, que le a tabela de areas
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
