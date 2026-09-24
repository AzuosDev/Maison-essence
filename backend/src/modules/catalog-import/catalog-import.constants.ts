import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Quantos produtos por lote.
 *
 * O lote não e uma otimização de banco — cada produto e uma leitura e uma
 * gravação de qualquer jeito. Ele e a fronteira de progresso: e onde o
 * relatório fecha uma conta parcial e onde uma importação interrompida para
 * com produtos inteiros gravados, nunca com meio produto.
 *
 * Cinquenta e o número que a rota HTTP consegue atravessar com folga dentro
 * do tempo de uma função da Vercel. O catálogo inteiro (269 produtos) não
 * cabe numa invocação; para a carga inicial existe o `npm run seed:catalog`,
 * que roda sem relógio.
 */
export const IMPORT_BATCH_SIZE = 50;

/**
 * Teto do corpo da rota de importação.
 *
 * O resto da API vive com 256 KB (ver `MAX_BODY_SIZE` em `bootstrap.ts`), que
 * e o tamanho de um produto com descrição longa. O catálogo inteiro tem 175
 * KB hoje e cresce a cada lista de fornecedor; 1 MB cobre o arquivo com folga
 * e continua sendo barato de recusar numa função serverless.
 */
/**
 * Quanto tempo a rota se permite gastar antes de parar num limite de lote.
 *
 * A função da Vercel e morta pelo relógio sem chance de responder nada — e uma
 * importação morta no meio deixa o cliente sem saber o que entrou. Oito
 * segundos cabem com folga no limite padrão de dez e sobra tempo para
 * serializar o relatório. Quem para no teto recebe quantos produtos faltaram e
 * manda o mesmo arquivo de novo.
 */
export const IMPORT_TIME_BUDGET_MS = 8_000;

export const MAX_IMPORT_BODY_SIZE = '1mb';

/** Tetos de sanidade do corpo. Não são regra de negócio, são anti-abuso. */
export const MAX_IMPORT_CATEGORIES = 500;
export const MAX_IMPORT_PRODUCTS = 2000;

/**
 * Limite de chamadas da importação.
 *
 * Bem abaixo do teto do painel (300/min) porque uma importação não e um
 * clique: e um lote de leituras e gravações que segura a função por segundos.
 * Cinco em cinco minutos e o bastante para uma carga em partes e curto para
 * um laço que resolveu reimportar o catálogo em looping.
 */
export const CATALOG_IMPORT_RATE_LIMIT: RateLimitRule = {
  scope: 'catalog-import',
  limit: 5,
  windowSeconds: 5 * 60,
};

export const CATALOG_ENVELOPE_MESSAGE =
  'O arquivo de catálogo precisa ser um objeto com as chaves categories e products.';

/** Slug que aparece no relatório quando a entrada nem slug tem. */
export const UNNAMED_ENTRY_SLUG = '(sem slug)';
