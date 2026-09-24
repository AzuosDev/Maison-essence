/**
 * Campos que nunca podem sair da API. Usado em duas camadas: no transform do
 * `toJSON` dos schemas (`src/database/base.schema.ts`) e no interceptor global
 * de resposta, que pega também objetos que não vieram do Mongoose.
 */
export const REDACTED_FIELDS: readonly string[] = ['__v', 'passwordHash', 'tokenHash'];
