import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { UserRole } from '../../../common/enums/user-role.js';
import { USER_ROLES, USER_ROLE_VALUES } from '../../../common/enums/user-role.js';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  createSchema,
  enumProp,
  integerProp,
  textProp,
} from '../../../database/schema-helpers.js';

/** Usuário do painel administrativo. O cliente da loja vive em `Customer`. */
@Schema(baseSchemaOptions({ collection: 'users' }))
export class User extends BaseSchema {
  @Prop(textProp({ required: true, max: 120 }))
  name: string;

  @Prop(textProp({ required: true, max: 160, lowercase: true }))
  email: string;

  /**
   * `select: false`: o hash não sai em consulta nenhuma por acidente. Quem
   * precisa dele — só o login — pede com `.select('+passwordHash')`.
   */
  @Prop(textProp({ required: true, max: 255, select: false }))
  passwordHash: string;

  @Prop(enumProp(USER_ROLE_VALUES, { required: true, default: USER_ROLES.STAFF }))
  role: UserRole;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** Nasce `true`: usuário criado pelo painel recebe senha temporária. */
  @Prop({ type: Boolean, default: true })
  mustChangePassword: boolean;

  /**
   * Versão da credencial, copiada para o payload do access token. Incrementar
   * aqui inválida na hora todos os tokens já emitidos para o usuário, sem
   * esperar os 15 minutos de expiração — e o que faz "desativar usuário"
   * derrubar a sessão dele de verdade.
   */
  @Prop(integerProp({ min: 1, default: 1 }))
  credentialVersion: number;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = createSchema(User);

UserSchema.index({ email: 1 }, { unique: true });
// Responde "quantos SUPER_ADMIN ativos existem?", a pergunta que impede o
// sistema de ficar sem nenhum administrador.
UserSchema.index({ role: 1, isActive: 1 });
