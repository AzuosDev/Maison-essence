import { USER_ROLES, type UserRole } from '@/features/auth';

/**
 * Quem vê o que, no painel.
 *
 * Três papéis e uma regra que não pode morar espalhada pelas telas:
 *
 * - **SUPER_ADMIN** alcança tudo: as áreas da loja, a área de sistema, a
 *   moldura das configurações e a exclusão definitiva de cadastro.
 * - **OWNER** opera a loja: catálogo, pedidos, entrega, pagamento e as
 *   configurações do dia a dia. E o dia a dia de vender, e e tudo o que ele
 *   precisa para isso. O que ele não faz e desfazer: apagar cadastro,
 *   administrar contas e mexer na moldura da loja.
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
 * Uma área só. **Sistema** não e área da loja: criar usuário, ler a trilha de
 * auditoria e conferir a saúde do servidor são tarefas de quem mantem a
 * aplicação, e deixa-las a vista de quem opera só cria a chance de alguém se
 * desativar sozinho numa tarde movimentada.
 *
 * **Configurações** fica de fora desta lista: o gerente abre a tela, porque e
 * nela que mora o que muda no expediente — o horário de atendimento, a barra
 * de avisos, o número do WhatsApp, a retirada na loja. O que naquela tela e
 * moldura da loja, e não operação, e recortado por campo e não por área; ver
 * `canEditStoreFrame`.
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
 * O papel escreve na loja: catálogo, categorias, entrega, pagamento e as
 * configurações do dia a dia.
 */
export function canManageStore(role: UserRole | undefined): boolean {
  return role !== undefined && role !== USER_ROLES.STAFF;
}

/**
 * O papel apaga cadastro para sempre: produto, categoria, cidade de entrega.
 *
 * Só o administrador. Não e desconfiança de quem opera a loja — e que para
 * tudo o que ela precisa fazer existe o caminho que desfaz: despublicar o
 * produto, desativar a categoria, desligar a cidade no checkout. Excluir
 * resolve o mesmo problema sem a volta, e a volta e justamente o que se quer
 * numa tarde movimentada.
 *
 * O backend decide igual (`@Roles(USER_ROLES.SUPER_ADMIN)` em cada `DELETE`),
 * então esconder o botão aqui e cortesia: poupa a pessoa de descobrir pelo
 * erro. A proteção esta no servidor.
 */
export function canDeleteForever(role: UserRole | undefined): boolean {
  return role === USER_ROLES.SUPER_ADMIN;
}

/**
 * O papel mexe na moldura da loja, dentro de Configurações.
 *
 * Moldura e o que aparece em toda página e não muda no expediente: o
 * carrossel da home, o perfume da vez, as páginas que o rodapé lista, as
 * redes sociais. O resto da tela — nome, contato, horário, barra de avisos,
 * frete grátis, retirada — e do gerente.
 *
 * A divisão e por campo, e não por área, porque a tela e uma: mandar o
 * gerente a uma segunda tela para corrigir o horário de atendimento seria
 * trocar uma permissão bem recortada por uma navegação ruim. O backend
 * recusa os mesmos campos no PATCH (`settings-access.policy.ts`).
 */
export function canEditStoreFrame(role: UserRole | undefined): boolean {
  return role === USER_ROLES.SUPER_ADMIN;
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
