import { z } from 'zod';

/**
 * As variáveis de ambiente da loja, conferidas uma vez no boot.
 *
 * Mesma postura do backend: se falta configuração, a aplicação para aqui, com
 * o nome da variável na mensagem. O contrário — seguir com `undefined` — troca
 * uma falha de dez segundos de leitura por um `fetch("undefined/products")`
 * descoberto em produção.
 *
 * Nada de segredo passa por aqui. Tudo o que tem o prefixo `VITE_` e embutido
 * no bundle em texto puro e fica visível para qualquer visitante: a API key do
 * Cloudinary e a secret ficam no backend, e o que sobe e só o `cloud name`,
 * que já aparece na URL de toda imagem publica.
 */

/** Em desenvolvimento, a API que `npm run start:dev` do backend sobe. */
const DEV_API_URL = 'http://localhost:3000/api/v1';

const MISSING_CLOUD_NAME =
  'VITE_CLOUDINARY_CLOUD_NAME não esta definida: sem ela nenhuma imagem do catálogo carrega.';

const schema = z.object({
  /**
   * URL da API com o prefixo global, sem barra no fim — o cliente HTTP monta
   * os caminhos como `/products`, e duas barras seguidas viram uma rota que
   * não existe.
   */
  VITE_API_URL: z
    .url('VITE_API_URL precisa ser uma URL completa, como https://api.exemplo.com/api/v1.')
    .transform((url) => url.replace(/\/+$/, '')),

  /**
   * Obrigatória no build de produção; em desenvolvimento cai para vazio, e o
   * helper de imagem devolve o placeholder local. E o que permite clonar o
   * repositório e rodar `npm run dev` sem ter conta no Cloudinary.
   */
  VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.DEV
    ? z.string().default('')
    : z.string().min(1, MISSING_CLOUD_NAME),
});

export type Env = z.infer<typeof schema>;

function readEnv(): Env {
  const result = schema.safeParse({
    VITE_API_URL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_API_URL : undefined),
    VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  });

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Configuração inválida. Confira o .env:\n${problems}`);
  }

  return result.data;
}

export const env: Env = readEnv();
