import { z } from 'zod';

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
