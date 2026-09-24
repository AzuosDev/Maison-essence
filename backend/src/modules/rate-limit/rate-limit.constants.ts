import type { RateLimitRule } from './rate-limit.decorator.js';

/** Resposta do limite estourado: genérica, sem contador nem tempo restante. */
export const TOO_MANY_REQUESTS_MESSAGE =
  'Muitas requisições em pouco tempo. Espere um instante e tente de novo.';

/**
 * Teto de qualquer rota aberta que não declarou regra própria.
 *
 * Vale para a loja inteira somada, e não por rota: quem esta navegando pede
 * catálogo, categorias, cidades e configuração na mesma tela, e um orçamento
 * por rota deixaria o robo que varre o catálogo multiplicar o teto pelo número
 * de rotas que ele conhece. Cento e vinte por minuto e folgado para uma pessoa
 * e curto para um laço.
 */
export const PUBLIC_RATE_LIMIT: RateLimitRule = {
  scope: 'public',
  limit: 120,
  windowSeconds: 60,
};

/**
 * Teto das rotas do painel, também somado por sessão de trabalho.
 *
 * Mais alto que o público porque o painel e conversado — uma tela de produto
 * salva variantes, recarrega a lista e busca categorias em sequência — e
 * porque do outro lado há alguém autenticado, não a internet. Ainda assim tem
 * teto: credencial vazada também varre banco de dados.
 */
export const ADMIN_RATE_LIMIT: RateLimitRule = {
  scope: 'admin',
  limit: 300,
  windowSeconds: 60,
};
