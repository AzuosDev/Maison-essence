import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Tempos e limites do módulo de autenticação.
 *
 * Ficam em constante, e não em variável de ambiente, porque são decisão de
 * segurança do produto e não configuração de ambiente: um access token de 15
 * minutos e o que torna aceitável não consultar lista de revogação a cada
 * request, e alguém afrouxar isso por variável derrubaria a premissa.
 */

/** Access token: curto de propósito. Quem renova e o refresh. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token: sete dias, rotacionado a cada uso. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Access token da conta de cliente: trinta minutos.
 *
 * Mais longo que o do painel porque o estrago possível e menor — a conta do
 * cliente vê os próprios pedidos e edita o próprio endereço, e não mexe em
 * preço, estoque nem usuário. E porque o custo de renovar no meio de um
 * checkout cai sobre a venda.
 */
export const CUSTOMER_ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

/** Refresh token da loja: trinta dias, também rotacionado a cada uso. */
export const CUSTOMER_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Piso de tamanho de senha, na criação de usuário e na troca.
 *
 * Quatro, a pedido da dona da loja, e vale dizer o que isso significa: o que
 * segura força bruta e comprimento, e uma senha de quatro caracteres cai em
 * segundos num ataque offline, se um dia o hash vazar. O argon2id encarece
 * cada tentativa e o limite de `LOGIN_MAX_ATTEMPTS` por janela atrasa quem
 * tenta pela porta da frente, mas nenhum dos dois cobre a diferença entre
 * quatro e doze.
 *
 * Nada de exigir símbolo ou maiúscula: regra de composição empurra para
 * "Senha@123" e não compra segurança.
 */
export const PASSWORD_MIN_LENGTH = 4;

/** Tentativas de login por janela, contadas por IP + e-mail. */
export const LOGIN_MAX_ATTEMPTS = 5;

/** Janela do rate limit do login. */
export const LOGIN_WINDOW_SECONDS = 15 * 60;

/**
 * Piso de duração da resposta de login.
 *
 * Sem ele, "e-mail inexistente" responde em 5 ms e "senha errada" em 60 ms,
 * porque só o segundo paga o argon2 — a diferença e um oráculo de quais
 * e-mails existem. O piso cobre também a variação das idas ao banco.
 */
export const LOGIN_MIN_DURATION_MS = 350;

/** Resposta única de login inválido: nunca diz o que estava errado. */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas.';

/** Resposta do rate limit: genérica, sem contador nem tempo restante. */
export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Muitas tentativas. Tente novamente mais tarde.';

/**
 * Credencial de cliente apresentada a uma rota do painel.
 *
 * Diz que a área e que não e dele, e não que a sessão expirou: o frontend
 * precisa saber que renovar o token não vai resolver.
 */
export const ADMIN_ONLY_MESSAGE = 'Esta área e do painel administrativo.';

/** Bloqueio das rotas administrativas enquanto a senha temporária não troca. */
export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  'Troque a senha temporária antes de usar o painel.';

/**
 * Limite do login no guard global: as mesmas cinco tentativas por quinze
 * minutos, contadas por IP.
 *
 * Não substitui o `LoginRateLimitService`, que conta só as falhas e por IP
 * somado ao e-mail. Os dois respondem a perguntas diferentes: aquele protege
 * uma conta de ser adivinhada de vários lugares, este protege a rota de virar
 * um laço — inclusive de quem acerta a senha e fica renovando sessão. Quem
 * estourar qualquer um dos dois recebe 429.
 */
export const LOGIN_RATE_LIMIT: RateLimitRule = {
  scope: 'auth-login',
  limit: LOGIN_MAX_ATTEMPTS,
  windowSeconds: LOGIN_WINDOW_SECONDS,
};
