/**
 * Tempos e limites do modulo de autenticacao.
 *
 * Ficam em constante, e nao em variavel de ambiente, porque sao decisao de
 * seguranca do produto e nao configuracao de ambiente: um access token de 15
 * minutos e o que torna aceitavel nao consultar lista de revogacao a cada
 * request, e alguem afrouxar isso por variavel derrubaria a premissa.
 */

/** Access token: curto de proposito. Quem renova e o refresh. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token: sete dias, rotacionado a cada uso. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Piso de tamanho de senha, na criacao de usuario e na troca.
 *
 * Doze e nao oito: o painel tem poucas contas e nenhuma delas troca de senha
 * toda semana, entao o custo de exigir uma senha longa e baixo e o ganho
 * contra ataque offline e direto. Nada de exigir simbolo ou maiuscula — o que
 * segura forca bruta e comprimento.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Tentativas de login por janela, contadas por IP + e-mail. */
export const LOGIN_MAX_ATTEMPTS = 5;

/** Janela do rate limit do login. */
export const LOGIN_WINDOW_SECONDS = 15 * 60;

/**
 * Piso de duracao da resposta de login.
 *
 * Sem ele, "e-mail inexistente" responde em 5 ms e "senha errada" em 60 ms,
 * porque so o segundo paga o argon2 — a diferenca e um oraculo de quais
 * e-mails existem. O piso cobre tambem a variacao das idas ao banco.
 */
export const LOGIN_MIN_DURATION_MS = 350;

/** Resposta unica de login invalido: nunca diz o que estava errado. */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciais invalidas.';

/** Resposta do rate limit: generica, sem contador nem tempo restante. */
export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Muitas tentativas. Tente novamente mais tarde.';

/** Bloqueio das rotas administrativas enquanto a senha temporaria nao troca. */
export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  'Troque a senha temporaria antes de usar o painel.';
