import type { UserRole } from '../../common/enums/user-role.js';
import type { AuditAction, AuditTargetKind } from './audit.constants.js';

/** Quem agiu. Sempre presente: acao sem ator nao e trilha, e ruido. */
export interface AuditActor {
  id: string;
  email: string;
  /** Ausente so no login recusado, onde nao ha usuario resolvido. */
  role?: UserRole;
}

/** Sobre o que a acao foi, com o rotulo que um humano reconhece. */
export interface AuditTarget {
  kind: AuditTargetKind;
  id: string;
  /** E-mail do usuario, codigo do pedido, nome do produto. */
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
  /** O diff, quando a acao foi uma edicao. */
  changes?: AuditChanges;
  /** O que mais explica a acao. Nunca senha, nunca token, nunca chave PIX. */
  details?: Record<string, unknown>;
}
