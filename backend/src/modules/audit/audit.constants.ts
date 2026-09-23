/**
 * O vocabulario da trilha de auditoria.
 *
 * Uma lista so, e nao uma por dominio, porque a pergunta que a trilha responde
 * atravessa os dominios: "o que aconteceu no painel na sexta a tarde?" nao se
 * responde lendo tres colecoes. O prefixo antes do ponto e o assunto, o que
 * vem depois e o verbo no passado.
 */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCEEDED: 'login.succeeded',
  LOGIN_FAILED: 'login.failed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  SETTINGS_UPDATED: 'settings.updated',
  PAYMENT_SETTINGS_UPDATED: 'payment-settings.updated',
  PRODUCT_PRICE_CHANGED: 'product.price_changed',
  CATALOG_IMPORTED: 'catalog.imported',
  ORDER_STATUS_CHANGED: 'order.status_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Sobre o que a acao foi. */
export const AUDIT_TARGETS = {
  USER: 'user',
  PRODUCT: 'product',
  ORDER: 'order',
  SETTINGS: 'settings',
  CATALOG: 'catalog',
} as const;

export type AuditTargetKind = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/**
 * Quem age quando nao ha usuario: o primeiro acesso, feito pelo processo.
 *
 * Fica como id porque a trilha nao aceita entrada sem ator — e "nao sei quem
 * foi" e uma informacao pior do que "foi o bootstrap".
 */
export const SYSTEM_ACTOR_ID = 'bootstrap';

/**
 * Quem age quando a credencial nao foi aceita: o login que falhou.
 *
 * O e-mail digitado fica na entrada, porque e o que responde "tentaram entrar
 * como quem?"; o papel fica vazio, porque quem tentou nao tem papel nenhum —
 * e pode nem existir como usuario.
 */
export const UNKNOWN_ACTOR_ID = 'anonimo';

/**
 * Chaves cujo valor nunca entra na trilha, venha de onde vier.
 *
 * A trilha e escrita por cinco servicos e lida por quem investiga; uma segunda
 * rede embaixo deles custa uma comparacao por campo e impede que um `details`
 * novo, escrito daqui a um ano, leve senha ou token junto sem ninguem notar.
 */
export const REDACTED_AUDIT_KEY = /senha|password|token|hash|secret/i;

// A chave PIX nao esta na lista porque ela chega aqui ja mascarada, da
// origem (ver `maskPixKey`). O valor apagado diria apenas que algo mudou; os
// quatro ultimos caracteres dizem para qual conta a loja passou a receber, e
// e essa a pergunta que a trilha existe para responder.

/** O que aparece no lugar do valor escondido. */
export const REDACTED_VALUE = '[redigido]';

/**
 * Por quanto tempo a trilha fica.
 *
 * Dois anos cobrem o que a loja pode precisar recuperar (um pedido do ano
 * passado, uma troca de preco que ninguem lembra) e evitam que a colecao
 * cresca para sempre num cluster gratuito. Se algum dia a exigencia for
 * guardar para sempre, o lugar de mudar e o indice TTL — nao o codigo.
 */
export const AUDIT_RETENTION_SECONDS = 2 * 365 * 24 * 60 * 60;
