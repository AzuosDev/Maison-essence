/**
 * Quantos banners a home aceita.
 *
 * Limite de tela, nao de negocio: um carrossel com mais que isso ninguem
 * assiste ate o fim, e o array vive dentro do documento de configuracoes.
 */
export const MAX_BANNERS = 12;

/** Teto do campo `order` — o mesmo declarado no schema do banner. */
export const MAX_BANNER_ORDER = 9999;

/** Teto do conteudo de uma pagina institucional, igual ao do schema. */
export const MAX_PAGE_CONTENT_LENGTH = 20_000;

export const PAGE_NOT_FOUND_MESSAGE = 'Página não encontrada.';

export const INVALID_BANNER_WINDOW_MESSAGE =
  'O período de exibição do banner termina antes de começar: a data de fim precisa ser posterior a de início.';

export function unknownBannersMessage(ids: readonly string[]): string {
  const alvo = ids.length === 1 ? 'Um banner citado não existe mais' : 'Banners citados não existem mais';

  return `${alvo}. Recarregue a pagina de configuracoes e tente de novo.`;
}
