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
 * Uma acao sensivel que alguem executou no painel.
 *
 * Ate aqui a trilha era so uma linha de log. Linha de log resolve a leitura do
 * dia seguinte e some com a retencao do provedor: na Vercel o log gratuito
 * guarda horas, e "quem mudou esse preco no mes passado?" nao tem resposta. A
 * colecao responde.
 *
 * Fica no mesmo banco do resto, com uma consequencia que vale escrever: quem
 * tem acesso de escrita ao banco pode apagar a propria pegada. A trilha protege
 * contra o uso indevido do painel, que e o risco real de uma loja pequena, e
 * nao contra o administrador do banco. Trilha a prova disso mora fora do
 * sistema auditado, e isso e outra decisao, com outro custo.
 *
 * Nada aqui e escrito por rota publica: o cliente da loja nao gera auditoria.
 * O que se registra e o que uma pessoa com credencial fez.
 */
@Schema(baseSchemaOptions({ collection: 'audit_entries' }))
export class AuditEntry extends BaseSchema {
  @Prop(enumProp<AuditAction>(ACTIONS, { required: true, index: true }))
  action: AuditAction;

  /** Id do usuario, ou `bootstrap` quando quem agiu foi o proprio processo. */
  @Prop(textProp({ required: true, max: 64 }))
  actorId: string;

  @Prop(textProp({ required: true, max: 160, lowercase: true }))
  actorEmail: string;

  // Vazio no login recusado: quem tentou entrar ainda nao tem papel.
  @Prop({ type: String, enum: [...Object.values(USER_ROLES), null], default: null })
  actorRole: UserRole | null;

  // A lista aceita nulo porque ha acao sem alvo: o login e sobre quem agiu.
  @Prop({ type: String, enum: [...TARGETS, null], default: null })
  targetKind: AuditTargetKind | null;

  @Prop(textProp({ max: 64, default: '' }))
  targetId: string;

  /** E-mail do usuario, codigo do pedido, nome do produto. */
  @Prop(textProp({ max: 200, default: '' }))
  targetLabel: string;

  /**
   * O diff e o contexto, como vieram do servico.
   *
   * `Mixed` porque a forma muda com a acao — um diff de configuracoes nao se
   * parece com a troca de status de um pedido — e porque a trilha e para ler,
   * nao para consultar campo a campo. Quem precisa filtrar usa `action`,
   * `actorId` e `targetId`, que sao colunas de verdade.
   */
  @Prop({ type: SchemaTypes.Mixed, default: null })
  changes: Record<string, unknown> | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  details: Record<string, unknown> | null;

  /** Liga a entrada as linhas de log da mesma requisicao. */
  @Prop(textProp({ max: 64, default: '' }))
  requestId: string;
}

export type AuditEntryDocument = HydratedDocument<AuditEntry>;

export const AuditEntrySchema = createSchema(AuditEntry);

// A leitura da trilha e sempre "o que aconteceu, do mais recente para tras",
// filtrando por acao ou por alvo. O indice de retencao logo abaixo ja cobre a
// ordenacao por data — indice de um campo so e percorrido nos dois sentidos.
AuditEntrySchema.index({ action: 1, createdAt: -1 });
AuditEntrySchema.index({ targetId: 1, createdAt: -1 });

// Retencao (ver `AUDIT_RETENTION_SECONDS`).
AuditEntrySchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_RETENTION_SECONDS });
