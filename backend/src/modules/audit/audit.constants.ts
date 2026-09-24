/**
 * O vocabulário da trilha de auditoria.
 *
 * Uma lista só, e não uma por domínio, porque a pergunta que a trilha responde
 * atravessa os domínios: "o que aconteceu no painel na sexta a tarde?" não se
 * responde lendo três coleções. O prefixo antes do ponto e o assunto, o que
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

/** Sobre o que a ação foi. */
export const AUDIT_TARGETS = {
  USER: 'user',
  PRODUCT: 'product',
  ORDER: 'order',
  SETTINGS: 'settings',
  CATALOG: 'catalog',
} as const;

export type AuditTargetKind = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/**
 * Quem age quando não há usuário: o primeiro acesso, feito pelo processo.
 *
 * Fica como id porque a trilha não aceita entrada sem ator — e "não sei quem
 * foi" e uma informação pior do que "foi o bootstrap".
 */
export const SYSTEM_ACTOR_ID = 'bootstrap';

/**
 * Quem age quando a credencial não foi aceita: o login que falhou.
 *
 * O e-mail digitado fica na entrada, porque e o que responde "tentaram entrar
 * como quem?"; o papel fica vazio, porque quem tentou não tem papel nenhum —
 * e pode nem existir como usuário.
 */
export const UNKNOWN_ACTOR_ID = 'anonimo';

/**
 * Chaves cujo valor nunca entra na trilha, venha de onde vier.
 *
 * A trilha e escrita por cinco serviços e lida por quem investiga; uma segunda
 * rede embaixo deles custa uma comparação por campo e impede que um `details`
 * novo, escrito daqui a um ano, leve senha ou token junto sem ninguém notar.
 */
export const REDACTED_AUDIT_KEY = /senha|password|token|hash|secret/i;

// A chave PIX não esta na lista porque ela chega aqui já mascarada, da
// origem (ver `maskPixKey`). O valor apagado diria apenas que algo mudou; os
// quatro últimos caracteres dizem para qual conta a loja passou a receber, e
// e essa a pergunta que a trilha existe para responder.

/** O que aparece no lugar do valor escondido. */
export const REDACTED_VALUE = '[redigido]';

/**
 * Por quanto tempo a trilha fica.
 *
 * Dois anos cobrem o que a loja pode precisar recuperar (um pedido do ano
 * passado, uma troca de preço que ninguém lembra) e evitam que a coleção
 * cresca para sempre num cluster gratuito. Se algum dia a exigência for
 * guardar para sempre, o lugar de mudar e o índice TTL — não o código.
 */
export const AUDIT_RETENTION_SECONDS = 2 * 365 * 24 * 60 * 60;
