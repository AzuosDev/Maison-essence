import { Schema } from '@nestjs/mongoose';
import type { SchemaOptions, Types } from 'mongoose';
import { REDACTED_FIELDS } from '../common/redacted-fields.js';

/**
 * Opcoes comuns a todo schema de dominio.
 *
 * O `@nestjs/mongoose` le o `@Schema()` da propria classe e nao sobe na cadeia
 * de heranca, entao cada schema precisa declarar as suas:
 *
 * ```ts
 * @Schema(baseSchemaOptions())
 * export class Product extends BaseSchema {
 *   @Prop({ required: true })
 *   name: string;
 * }
 * ```
 */
export function baseSchemaOptions(overrides: SchemaOptions = {}): SchemaOptions {
  return {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true, transform: toPublicJSON },
    toObject: { virtuals: true },
    ...overrides,
  };
}

/**
 * Campos que todo documento ganha de graca. Serve so para tipagem: `_id` e
 * virtual e os timestamps vem de `timestamps: true`, nenhum precisa de `@Prop`.
 */
@Schema(baseSchemaOptions())
export abstract class BaseSchema {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

type PlainDocument = Record<string, unknown> & { _id?: Types.ObjectId | string };

function toPublicJSON(_doc: unknown, plain: PlainDocument): Record<string, unknown> {
  const { _id, ...rest } = plain;
  // `id` primeiro para que ele abra o objeto na resposta, como um id deve.
  const result: Record<string, unknown> =
    _id === undefined ? { ...rest } : { id: String(_id), ...rest };

  for (const field of REDACTED_FIELDS) {
    delete result[field];
  }

  return result;
}
