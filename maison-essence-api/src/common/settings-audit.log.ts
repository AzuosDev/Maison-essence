import { Injectable, Logger } from '@nestjs/common';
import type { AuditParty } from './user-audit.log.js';

/** Acoes auditadas sobre as configuracoes da loja. */
export const SETTINGS_AUDIT_ACTIONS = {
  UPDATED: 'settings.updated',
} as const;

export type SettingsAuditAction =
  (typeof SETTINGS_AUDIT_ACTIONS)[keyof typeof SETTINGS_AUDIT_ACTIONS];

/** Um campo que mudou, com o valor de antes e o de depois. */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/** O que mudou, indexado pelo caminho do campo (`pickupAddress.city`). */
export type SettingsDiff = Record<string, FieldChange>;

export interface SettingsAuditEntry {
  action: SettingsAuditAction;
  actor: AuditParty;
  changes: SettingsDiff;
}

/**
 * Trilha de auditoria das configuracoes da loja.
 *
 * Mesma escolha da trilha de usuarios (`user-audit.log.ts`): uma linha JSON
 * no log do processo, que na Vercel e o que fica pesquisavel, e nao uma
 * colecao que o proprio painel administra e que o auditado poderia limpar.
 *
 * Grava o diff, e nao o documento inteiro, porque a pergunta que essa trilha
 * responde e "quem trocou o numero do WhatsApp na sexta?" — e o documento
 * inteiro a cada gravacao esconde exatamente essa resposta no meio do resto.
 */
@Injectable()
export class SettingsAuditLog {
  private readonly logger = new Logger('SettingsAudit');

  record(entry: SettingsAuditEntry): void {
    this.logger.log(JSON.stringify({ ...entry, at: new Date().toISOString() }));
  }
}
