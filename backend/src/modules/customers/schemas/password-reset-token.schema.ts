import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, baseSchemaOptions } from '../../../database/base.schema.js';
import {
  createSchema,
  integerProp,
  objectIdProp,
  textProp,
} from '../../../database/schema-helpers.js';

/**
 * Um pedido de recuperação de senha em aberto.
 *
 * ## O token não fica aqui
 *
 * O que vai no e-mail e um segredo aleatório; o que fica gravado e o hash
 * dele. Quem conseguisse ler esta coleção — um dump, um backup esquecido, um
 * log de consulta — não abriria conta nenhuma com o que encontrasse. E a mesma
 * razão pela qual a senha não e gravada em claro, e vale igual: enquanto o
 * token vive, ele **e** a senha.
 *
 * SHA-256 aqui e argon2 na senha, e não e incoerência. Senha e curta,
 * escolhida por gente e repetida entre sites, então precisa de hash lento para
 * resistir a força bruta sobre um banco roubado. Este token são trinta e dois
 * bytes sorteados que vivem trinta minutos — adivinhar e impossível por
 * tamanho, não por custo —, e um hash lento poria argon2 no caminho de uma
 * rota publica, que e um jeito fácil de derrubar o servidor.
 *
 * ## Some sozinho
 *
 * O TTL em `expiresAt` apaga o documento quando ele vence. A coleção não
 * cresce, não pede limpeza, e um pedido esquecido não vira dado guardado para
 * sempre.
 */
@Schema(baseSchemaOptions({ collection: 'password_reset_tokens' }))
export class PasswordResetToken extends BaseSchema {
  @Prop(objectIdProp({ ref: 'Customer', required: true }))
  customerId: Types.ObjectId;

  /** SHA-256 do token que foi no e-mail, em hexadecimal. */
  @Prop(textProp({ required: true, max: 64, select: false }))
  tokenHash: string;

  /**
   * Quando deixa de valer — e quando o Mongo apaga o documento.
   *
   * O varredor do TTL roda de minuto em minuto, então o documento sobrevive um
   * pouco ao vencimento. Quem decide se o token ainda vale e a comparação de
   * data na hora de usar, nunca a existência do registro.
   */
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /**
   * Quando foi usado. Preenchido, o link não abre mais nada.
   *
   * Marcar em vez de apagar e o que permite responder a quem clicou duas vezes
   * no mesmo link sem fingir que ele nunca existiu.
   */
  @Prop({ type: Date, default: null })
  usedAt: Date | null;

  /**
   * Tentativas com token errado sobre este pedido.
   *
   * Cobre o que o teto por IP não cobre: o token e sorteado, mas quem tentasse
   * adivinhar poderia vir de endereços diferentes. Poucas tentativas erradas
   * encerram o pedido, e a pessoa pede outro.
   */
  @Prop(integerProp({ default: 0, min: 0 }))
  attempts: number;
}

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;

export const PasswordResetTokenSchema = createSchema(PasswordResetToken);

PasswordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });

/**
 * Achar o pedido em aberto de uma conta.
 *
 * Pedir de novo encerra o anterior (ver `PasswordResetService`): dois links
 * vivos para a mesma conta dobrariam a janela de quem tivesse acesso a uma
 * caixa de entrada antiga.
 */
PasswordResetTokenSchema.index({ customerId: 1, usedAt: 1 });

// O próprio Mongo apaga o registro vencido: depois disso ele não serve para
// nada — nem para abrir, nem para contar tentativa.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
