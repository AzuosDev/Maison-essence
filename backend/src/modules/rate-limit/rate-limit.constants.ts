import type { RateLimitRule } from './rate-limit.decorator.js';

/** Resposta do limite estourado: generica, sem contador nem tempo restante. */
export const TOO_MANY_REQUESTS_MESSAGE =
  'Muitas requisições em pouco tempo. Espere um instante e tente de novo.';

/**
 * Teto de qualquer rota aberta que nao declarou regra propria.
 *
 * Vale para a loja inteira somada, e nao por rota: quem esta navegando pede
 * catalogo, categorias, cidades e configuracao na mesma tela, e um orcamento
 * por rota deixaria o robo que varre o catalogo multiplicar o teto pelo numero
 * de rotas que ele conhece. Cento e vinte por minuto e folgado para uma pessoa
 * e curto para um laco.
 */
export const PUBLIC_RATE_LIMIT: RateLimitRule = {
  scope: 'public',
  limit: 120,
  windowSeconds: 60,
};

/**
 * Teto das rotas do painel, tambem somado por sessao de trabalho.
 *
 * Mais alto que o publico porque o painel e conversado — uma tela de produto
 * salva variantes, recarrega a lista e busca categorias em sequencia — e
 * porque do outro lado ha alguem autenticado, nao a internet. Ainda assim tem
 * teto: credencial vazada tambem varre banco de dados.
 */
export const ADMIN_RATE_LIMIT: RateLimitRule = {
  scope: 'admin',
  limit: 300,
  windowSeconds: 60,
};
