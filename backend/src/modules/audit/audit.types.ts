import type { UserRole } from '../../common/enums/user-role.js';
import type { AuditAction, AuditTargetKind } from './audit.constants.js';

/** Quem agiu. Sempre presente: ação sem ator não e trilha, e ruído. */
export interface AuditActor {
  id: string;
  email: string;
  /** Ausente só no login recusado, onde não há usuário resolvido. */
  role?: UserRole;
}

/** Sobre o que a ação foi, com o rótulo que um humano reconhece. */
export interface AuditTarget {
  kind: AuditTargetKind;
  id: string;
  /** E-mail do usuário, código do pedido, nome do produto. */
  label?: string;
}

/** Um campo que mudou, com o valor de antes e o de depois. */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/** O que mudou, indexado pelo caminho do campo (`pickupAddress.city`). */
export type AuditChanges = Record<string, FieldChange>;

export interface AuditEntryInput {
  action: AuditAction;
  actor: AuditActor;
  target?: AuditTarget;
  /** O diff, quando a ação foi uma edição. */
  changes?: AuditChanges;
  /** O que mais explica a ação. Nunca senha, nunca token, nunca chave PIX. */
  details?: Record<string, unknown>;
}
