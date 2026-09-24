import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../modules/auth/auth.constants.js';

const MIN_SECRET_LENGTH = 32;
const SECRET_TOO_SHORT = `deve ter ao menos ${MIN_SECRET_LENGTH} caracteres`;

/**
 * Variavel que pode nao existir.
 *
 * O `preprocess` trata string vazia como ausente: apagar uma variavel no
 * painel da Vercel costuma deixar `''` para tras, e `''` reprovado pelo schema
 * derrubaria o boot em vez de significar "nao configurado".
 */
function optional<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  // Origens do CORS, uma a uma. Curinga e recusado no boot de proposito: com
  // `credentials: true` ele nem funcionaria no navegador, e a tentacao de
  // liberar tudo "so para destravar o deploy" acaba virando permanente.
  CORS_ORIGINS: z
    .string()
    .min(1, 'informe ao menos uma origem, separada por virgula')
    .refine(
      (value) => !parseCorsOrigins(value).includes('*'),
      'curinga não e aceito: liste as origens uma a uma',
    )
    .refine(
      (value) => parseCorsOrigins(value).every(isOrigin),
      'cada origem precisa ser um endereço http(s) sem caminho, como https://loja.com.br',
    ),
  APP_VERSION: z.string().min(1).default(process.env.npm_package_version ?? '0.0.0'),
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      'deve começar com mongodb:// ou mongodb+srv://',
    ),
  // O nome do banco vem sempre daqui, nunca do caminho da URI: o Atlas entrega
  // a string de conexao sem banco e o Mongoose cairia no default "test".
  MONGODB_DB_NAME: z.string().min(1).default('maison-essence'),
  // Segredos dos tokens. O piso de 32 caracteres nao e enfeite: a assinatura
  // HS256 nao e mais forte que o segredo, e segredo curto vira access token
  // forjado com o papel que o atacante quiser.
  JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
  JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
  // Segredos da conta de cliente. Separados dos do painel de proposito: sao
  // duas populacoes com riscos diferentes — o cadastro do cliente e aberto na
  // internet, o do painel nao — e um segredo vazado de um lado nao pode
  // assinar token do outro. Com chaves distintas, "token de cliente vira token
  // de administrador" deixa de depender de o codigo conferir alguma claim.
  JWT_CUSTOMER_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
  JWT_CUSTOMER_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT),
  // Conta do Cloudinary, onde ficam as imagens. As tres sao opcionais porque
  // nenhuma outra rota depende delas: a API sobe e a loja funciona sem conta
  // de imagens, e so o envio de fotos responde 503 ate elas existirem. O
  // segredo assina os uploads e nunca vai para o navegador.
  CLOUDINARY_CLOUD_NAME: optional(z.string().min(1)),
  CLOUDINARY_API_KEY: optional(z.string().min(1)),
  CLOUDINARY_API_SECRET: optional(z.string().min(1)),
  // Criacao do primeiro SUPER_ADMIN. As tres sao opcionais porque a API
  // precisa subir sem elas: depois do primeiro acesso elas saem do ambiente,
  // e uma variavel obrigatoria que deve ser removida e uma contradicao.
  BOOTSTRAP_SUPERADMIN_EMAIL: optional(
    z.email('informe um e-mail válido').transform((email) => email.trim().toLowerCase()),
  ),
  BOOTSTRAP_SUPERADMIN_PASSWORD: optional(
    z.string().min(PASSWORD_MIN_LENGTH, `deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`),
  ),
  BOOTSTRAP_SUPERADMIN_NAME: z.string().min(1).max(120).default('Super Admin'),
  // Usuario e senha da documentacao em producao. As duas juntas ou nenhuma:
  // sem elas, `/api/v1/docs` nao sobe em producao (ver `swagger.ts`). Fora de
  // producao a documentacao e aberta, porque ali ela e ferramenta de trabalho.
  DOCS_USER: optional(z.string().min(1)),
  DOCS_PASSWORD: optional(z.string().min(12, 'deve ter ao menos 12 caracteres')),
  // Libera POST /auth/bootstrap. Sem ela a rota responde 404, que e o estado
  // em que o projeto deve ficar depois do primeiro acesso.
  BOOTSTRAP_SECRET: optional(z.string().min(MIN_SECRET_LENGTH, SECRET_TOO_SHORT)),
})
  /**
   * Os quatro segredos precisam ser diferentes entre si.
   *
   * Com o mesmo valor no access e no refresh, um refresh token passaria por
   * access token e pularia a rotacao inteira — o que o guard confere e a
   * assinatura. Entre painel e cliente o risco e maior ainda: segredos iguais
   * fariam um access token de cliente ser aceito como credencial de
   * administrador, e a separacao das duas contas viraria uma linha de codigo
   * em vez de uma chave.
   */
  .superRefine((env, ctx) => {
    const secrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_CUSTOMER_ACCESS_SECRET',
      'JWT_CUSTOMER_REFRESH_SECRET',
    ] as const;
    const seen = new Map<string, string>();

    for (const name of secrets) {
      const twin = seen.get(env[name]);

      if (twin === undefined) {
        seen.set(env[name], name);
      } else {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `deve ser diferente de ${twin}`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(issues: readonly string[]) {
    super(
      [
        'Falha ao validar as variáveis de ambiente:',
        ...issues.map((issue) => `  - ${issue}`),
        '',
        'Confira o arquivo .env.example e defina as variáveis faltantes.',
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

        return `${path}: ${isMissing ? 'variável obrigatória ausente' : issue.message}`;
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

/**
 * Origem no sentido do navegador: esquema, host e porta, sem caminho.
 *
 * `https://loja.com.br/` com a barra no fim nao e a mesma coisa que o
 * navegador manda no cabecalho `Origin`, e a comparacao exata falharia em
 * producao com o erro mais confuso possivel — tudo funcionando, menos o
 * navegador. Reprovar no boot troca isso por uma mensagem.
 */
function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname === '/' &&
      !value.endsWith('/')
    );
  } catch {
    return false;
  }
}
