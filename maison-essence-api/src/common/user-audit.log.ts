import { Injectable, Logger } from '@nestjs/common';
import type { UserRole } from './enums/user-role.js';

/** Acoes auditadas sobre um usuario administrativo. */
export const USER_AUDIT_ACTIONS = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  ACTIVATED: 'user.activated',
  DEACTIVATED: 'user.deactivated',
  PASSWORD_RESET: 'user.password_reset',
  PASSWORD_CHANGED: 'user.password_changed',
} as const;

export type UserAuditAction =
  (typeof USER_AUDIT_ACTIONS)[keyof typeof USER_AUDIT_ACTIONS];

/** Quem agiu e sobre quem. Sempre os dois, mesmo quando sao a mesma pessoa. */
export interface AuditParty {
  id: string;
  email: string;
  role: UserRole;
}

export interface UserAuditEntry {
  action: UserAuditAction;
  actor: AuditParty;
  target: AuditParty;
  /** O que mudou. Nunca senha, nunca hash. */
  details?: Record<string, unknown>;
}

/**
 * Trilha de auditoria das acoes sobre usuarios.
 *
 * Sai como uma linha JSON no log do processo, que na Vercel e o que fica
 * pesquisavel. Nao vai para colecao nenhuma de proposito: log de auditoria em
 * banco que o proprio painel administra e apagavel por quem esta sendo
 * auditado.
 *
 * Mora em `common/` porque duas casas escrevem nela: o modulo de usuarios e a
 * troca de senha, que vive nas rotas de autenticacao.
 */
@Injectable()
export class UserAuditLog {
  private readonly logger = new Logger('UserAudit');

  record(entry: UserAuditEntry): void {
    this.logger.log(JSON.stringify({ ...entry, at: new Date().toISOString() }));
  }
}
