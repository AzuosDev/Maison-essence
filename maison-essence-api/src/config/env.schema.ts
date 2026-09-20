import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;
const SECRET_TOO_SHORT = `deve ter ao menos ${MIN_SECRET_LENGTH} caracteres`;

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  CORS_ORIGINS: z
    .string()
    .min(1, 'informe ao menos uma origem, separada por virgula'),
  APP_VERSION: z.string().min(1).default(process.env.npm_package_version ?? '0.0.0'),
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      'deve comecar com mongodb:// ou mongodb+srv://',
    ),
  // O nome do banco vem sempre daqui, nunca do caminho da URI: o Atlas entrega
  // a string de conexao sem banco e o Mongoose cairia no default "test".
  MONGODB_DB_NAME: z.string().min(1).default('maison-essence'),
  // Segredos dos tokens. O piso de 32 caracteres nao e enfeite: a assinatura
  // HS256 nao e mais forte que o segredo, e segredo curto vira access token
  // forjado com o papel que o atacante quiser.
  JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
  JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
})
  // Com os dois segredos iguais, um refresh token passaria por access token e
  // pularia a rotacao inteira — o que o guard confere e a assinatura.
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'deve ser diferente de JWT_ACCESS_SECRET',
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(issues: readonly string[]) {
    super(
      [
        'Falha ao validar as variaveis de ambiente:',
        ...issues.map((issue) => `  - ${issue}`),
        '',
        'Confira o arquivo .env.example e defina as variaveis faltantes.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => {
        const key = issue.path[0];
        const path = issue.path.join('.') || '(raiz)';
        const isMissing = typeof key === 'string' && raw[key] === undefined;

        return `${path}: ${isMissing ? 'variavel obrigatoria ausente' : issue.message}`;
      }),
    );
  }

  return result.data;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
