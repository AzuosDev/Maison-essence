import type { UserRole } from '@/features/auth';

/**
 * O que a area de sistema consome da API.
 *
 * Espelhos escritos a mao, como o resto de `features/auth`: o frontend
 * consome a API publicada, nao o codigo dela. Os campos aqui sao os que
 * quebram a tela na hora se divergirem, e por isso valem ser conferidos
 * quando o contrato mudar.
 *
 * ## Por que `SystemUser` nao e `AdminUser`
 *
 * Sao duas vistas do mesmo registro, e diferentes de proposito. `AdminUser`
 * e **quem esta logado**: tem `credentialVersion`, que so interessa a
 * sessao. `SystemUser` e **um usuario na lista**: tem `createdAt` e
 * `updatedAt`, que so interessam a quem administra. Juntar as duas criaria
 * um tipo com metade dos campos sempre irrelevante.
 */
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Senha temporaria pendente: a pessoa ainda nao entrou de verdade. */
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
   * nao a gera. Quem gera e o painel — ver `temporary-password.ts` —, e por
   * isso ela existe em texto de um lado so, por uma chamada.
   */
  temporaryPassword: string;
}

/** Edicao de cadastro. Status e senha tem rota propria: sao acoes. */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

/** A resposta do reset: a senha em texto, uma vez so. */
export interface PasswordResetResult {
  user: SystemUser;
  temporaryPassword: string;
}

/* ---- Auditoria ---------------------------------------------------------- */

/**
 * O vocabulario da trilha, igual ao do backend.
 *
 * O prefixo antes do ponto e o assunto; o que vem depois e o verbo no
 * passado. A lista e fechada porque o filtro por acao e um `<select>`: uma
 * acao nova no servidor aparece na lista mesmo sem entrar aqui — ver
 * `describeAction` —, so nao ganha filtro proprio ate alguem adiciona-la.
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
 * Uma acao registrada.
 *
 * `changes` e `details` sao `Mixed` no banco e chegam com a forma que o
 * servico que os escreveu lhes deu — um diff de configuracoes nao se parece
 * com a troca de status de um pedido. Quem os traduz em linhas legiveis e
 * `audit-diff.ts`, e e la que a variacao esta tratada.
 */
export interface AuditEntry {
  id: string;
  /**
   * A acao, como o servidor a gravou.
   *
   * `string` e nao `AuditAction`: a trilha guarda dois anos, e uma acao
   * criada depois desta versao do painel tem de aparecer na lista em vez de
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
  /** Id do usuario que agiu. */
  actorId?: string;
  action?: string;
  /** Recorte por data, em ISO. `from` inclusivo, `to` exclusivo. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

/* ---- Saude -------------------------------------------------------------- */

export type DatabaseStatus =
  'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'uninitialized';

export interface HealthStatus {
  status: 'ok' | 'error';
  /** Segundos desde que o processo subiu. */
  uptime: number;
  version: string;
  database: { status: DatabaseStatus; readyState: number };
}

/** Quantos documentos ha em uma colecao. */
export interface CollectionCount {
  name: string;
  count: number;
}

/** O que o seed de demonstracao criou. */
export interface SeedResult {
  collections: CollectionCount[];
}
