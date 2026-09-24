import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes } from 'mongoose';
import { USER_ROLES } from '../../../common/enums/user-role.js';
import type { UserRole } from '../../../common/enums/user-role.js';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import { createSchema, enumProp, textProp } from '../../../database/schema-helpers.js';
import { AUDIT_ACTIONS, AUDIT_RETENTION_SECONDS, AUDIT_TARGETS } from '../audit.constants.js';
import type { AuditAction, AuditTargetKind } from '../audit.constants.js';

const ACTIONS = Object.values(AUDIT_ACTIONS);
const TARGETS = Object.values(AUDIT_TARGETS);

/**
 * Uma ação sensível que alguém executou no painel.
 *
 * Até aqui a trilha era só uma linha de log. Linha de log resolve a leitura do
 * dia seguinte e some com a retenção do provedor: na Vercel o log gratuito
 * guarda horas, e "quem mudou esse preço no mês passado?" não tem resposta. A
 * coleção responde.
 *
 * Fica no mesmo banco do resto, com uma consequência que vale escrever: quem
 * tem acesso de escrita ao banco pode apagar a própria pegada. A trilha protege
 * contra o uso indevido do painel, que e o risco real de uma loja pequena, e
 * não contra o administrador do banco. Trilha a prova disso mora fora do
 * sistema auditado, e isso e outra decisão, com outro custo.
 *
 * Nada aqui e escrito por rota publica: o cliente da loja não gera auditoria.
 * O que se registra e o que uma pessoa com credencial fez.
 */
@Schema(baseSchemaOptions({ collection: 'audit_entries' }))
export class AuditEntry extends BaseSchema {
  @Prop(enumProp<AuditAction>(ACTIONS, { required: true, index: true }))
  action: AuditAction;

  /** Id do usuário, ou `bootstrap` quando quem agiu foi o próprio processo. */
  @Prop(textProp({ required: true, max: 64 }))
  actorId: string;

  @Prop(textProp({ required: true, max: 160, lowercase: true }))
  actorEmail: string;

  // Vazio no login recusado: quem tentou entrar ainda não tem papel.
  @Prop({ type: String, enum: [...Object.values(USER_ROLES), null], default: null })
  actorRole: UserRole | null;

  // A lista aceita nulo porque há ação sem alvo: o login e sobre quem agiu.
  @Prop({ type: String, enum: [...TARGETS, null], default: null })
  targetKind: AuditTargetKind | null;

  @Prop(textProp({ max: 64, default: '' }))
  targetId: string;

  /** E-mail do usuário, código do pedido, nome do produto. */
  @Prop(textProp({ max: 200, default: '' }))
  targetLabel: string;

  /**
   * O diff e o contexto, como vieram do serviço.
   *
   * `Mixed` porque a forma muda com a ação — um diff de configurações não se
   * parece com a troca de status de um pedido — e porque a trilha e para ler,
   * não para consultar campo a campo. Quem precisa filtrar usa `action`,
   * `actorId` e `targetId`, que são colunas de verdade.
   */
  @Prop({ type: SchemaTypes.Mixed, default: null })
  changes: Record<string, unknown> | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  details: Record<string, unknown> | null;

  /** Liga a entrada as linhas de log da mesma requisição. */
  @Prop(textProp({ max: 64, default: '' }))
  requestId: string;
}

export type AuditEntryDocument = HydratedDocument<AuditEntry>;

export const AuditEntrySchema = createSchema(AuditEntry);

// A leitura da trilha e sempre "o que aconteceu, do mais recente para trás",
// filtrando por ação ou por alvo. O índice de retenção logo abaixo já cobre a
// ordenação por data — índice de um campo só e percorrido nos dois sentidos.
AuditEntrySchema.index({ action: 1, createdAt: -1 });
AuditEntrySchema.index({ targetId: 1, createdAt: -1 });

// Retenção (ver `AUDIT_RETENTION_SECONDS`).
AuditEntrySchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_RETENTION_SECONDS });
