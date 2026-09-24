import type { UserRole } from '@/features/auth';

/**
 * O que a área de sistema consome da API.
 *
 * Espelhos escritos a mão, como o resto de `features/auth`: o frontend
 * consome a API publicada, não o código dela. Os campos aqui são os que
 * quebram a tela na hora se divergirem, e por isso valem ser conferidos
 * quando o contrato mudar.
 *
 * ## Por que `SystemUser` não e `AdminUser`
 *
 * São duas vistas do mesmo registro, e diferentes de propósito. `AdminUser`
 * e **quem esta logado**: tem `credentialVersion`, que só interessa a
 * sessão. `SystemUser` e **um usuário na lista**: tem `createdAt` e
 * `updatedAt`, que só interessam a quem administra. Juntar as duas criaria
 * um tipo com metade dos campos sempre irrelevante.
 */
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Senha temporária pendente: a pessoa ainda não entrou de verdade. */
  mustChangePassword: boolean;
  /** `null` em quem nunca entrou. */
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  /**
   * A senha do primeiro acesso.
   *
   * Vai no corpo porque e a rota que a pede: `POST /users` recebe a senha,
   * não a gera. Quem gera e o painel — ver `temporary-password.ts` —, e por
   * isso ela existe em texto de um lado só, por uma chamada.
   */
  temporaryPassword: string;
}

/** Edição de cadastro. Status e senha tem rota própria: são ações. */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

/** A resposta do reset: a senha em texto, uma vez só. */
export interface PasswordResetResult {
  user: SystemUser;
  temporaryPassword: string;
}

/* ---- Auditoria ---------------------------------------------------------- */

/**
 * O vocabulário da trilha, igual ao do backend.
 *
 * O prefixo antes do ponto e o assunto; o que vem depois e o verbo no
 * passado. A lista e fechada porque o filtro por ação e um `<select>`: uma
 * ação nova no servidor aparece na lista mesmo sem entrar aqui — ver
 * `describeAction` —, só não ganha filtro próprio até alguém adiciona-lá.
 */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCEEDED: 'login.succeeded',
  LOGIN_FAILED: 'login.failed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  SETTINGS_UPDATED: 'settings.updated',
  PAYMENT_SETTINGS_UPDATED: 'payment-settings.updated',
  PRODUCT_PRICE_CHANGED: 'product.price_changed',
  ORDER_STATUS_CHANGED: 'order.status_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_TARGETS = {
  USER: 'user',
  PRODUCT: 'product',
  ORDER: 'order',
  SETTINGS: 'settings',
} as const;

export type AuditTargetKind = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/** Um campo que mudou, com o valor de antes e o de depois. */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Uma ação registrada.
 *
 * `changes` e `details` são `Mixed` no banco e chegam com a forma que o
 * serviço que os escreveu lhes deu — um diff de configurações não se parece
 * com a troca de status de um pedido. Quem os traduz em linhas legíveis e
 * `audit-diff.ts`, e e lá que a variação esta tratada.
 */
export interface AuditEntry {
  id: string;
  /**
   * A ação, como o servidor a gravou.
   *
   * `string` e não `AuditAction`: a trilha guarda dois anos, e uma ação
   * criada depois desta versão do painel tem de aparecer na lista em vez de
   * quebrar a tipagem. `describeAction` traduz o que conhece e mostra o
   * identificador cru para o resto.
   */
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole | null;
  targetKind: AuditTargetKind | null;
  targetId: string;
  targetLabel: string;
  changes: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  requestId: string;
  createdAt: string;
}

export interface AuditListParams {
  /** Id do usuário que agiu. */
  actorId?: string;
  action?: string;
  /** Recorte por data, em ISO. `from` inclusivo, `to` exclusivo. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

/* ---- Saúde -------------------------------------------------------------- */

export type DatabaseStatus =
  'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'uninitialized';

export interface HealthStatus {
  status: 'ok' | 'error';
  /** Segundos desde que o processo subiu. */
  uptime: number;
  version: string;
  database: { status: DatabaseStatus; readyState: number };
}

/** Quantos documentos há em uma coleção. */
export interface CollectionCount {
  name: string;
  count: number;
}

/** O que o seed de demonstração criou. */
export interface SeedResult {
  collections: CollectionCount[];
}
