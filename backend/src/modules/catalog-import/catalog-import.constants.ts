import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Quantos produtos por lote.
 *
 * O lote nao e uma otimizacao de banco — cada produto e uma leitura e uma
 * gravacao de qualquer jeito. Ele e a fronteira de progresso: e onde o
 * relatorio fecha uma conta parcial e onde uma importacao interrompida para
 * com produtos inteiros gravados, nunca com meio produto.
 *
 * Cinquenta e o numero que a rota HTTP consegue atravessar com folga dentro
 * do tempo de uma funcao da Vercel. O catalogo inteiro (269 produtos) nao
 * cabe numa invocacao; para a carga inicial existe o `npm run seed:catalog`,
 * que roda sem relogio.
 */
export const IMPORT_BATCH_SIZE = 50;

/**
 * Teto do corpo da rota de importacao.
 *
 * O resto da API vive com 256 KB (ver `MAX_BODY_SIZE` em `bootstrap.ts`), que
 * e o tamanho de um produto com descricao longa. O catalogo inteiro tem 175
 * KB hoje e cresce a cada lista de fornecedor; 1 MB cobre o arquivo com folga
 * e continua sendo barato de recusar numa funcao serverless.
 */
/**
 * Quanto tempo a rota se permite gastar antes de parar num limite de lote.
 *
 * A funcao da Vercel e morta pelo relogio sem chance de responder nada — e uma
 * importacao morta no meio deixa o cliente sem saber o que entrou. Oito
 * segundos cabem com folga no limite padrao de dez e sobra tempo para
 * serializar o relatorio. Quem para no teto recebe quantos produtos faltaram e
 * manda o mesmo arquivo de novo.
 */
export const IMPORT_TIME_BUDGET_MS = 8_000;

export const MAX_IMPORT_BODY_SIZE = '1mb';

/** Tetos de sanidade do corpo. Nao sao regra de negocio, sao anti-abuso. */
export const MAX_IMPORT_CATEGORIES = 500;
export const MAX_IMPORT_PRODUCTS = 2000;

/**
 * Limite de chamadas da importacao.
 *
 * Bem abaixo do teto do painel (300/min) porque uma importacao nao e um
 * clique: e um lote de leituras e gravacoes que segura a funcao por segundos.
 * Cinco em cinco minutos e o bastante para uma carga em partes e curto para
 * um laco que resolveu reimportar o catalogo em looping.
 */
export const CATALOG_IMPORT_RATE_LIMIT: RateLimitRule = {
  scope: 'catalog-import',
  limit: 5,
  windowSeconds: 5 * 60,
};

export const CATALOG_ENVELOPE_MESSAGE =
  'O arquivo de catalogo precisa ser um objeto com as chaves categories e products.';

/** Slug que aparece no relatorio quando a entrada nem slug tem. */
export const UNNAMED_ENTRY_SLUG = '(sem slug)';
