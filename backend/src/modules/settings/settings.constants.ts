/**
 * Quantos banners a home aceita.
 *
 * Limite de tela, não de negócio: um carrossel com mais que isso ninguém
 * assiste até o fim, e o array vive dentro do documento de configurações.
 */
export const MAX_BANNERS = 12;

/** Teto do campo `order` — o mesmo declarado no schema do banner. */
export const MAX_BANNER_ORDER = 9999;

/** Teto do conteúdo de uma página institucional, igual ao do schema. */
export const MAX_PAGE_CONTENT_LENGTH = 20_000;

/**
 * Quanto cabe na frase do brinde.
 *
 * Cento e vinte caracteres e o que entra no balão da loja sem ele virar
 * parágrafo: a frase completa "Compre R$ 179,99 e ganhe ___" e e lida de
 * relance, no canto da tela, por quem esta olhando perfume.
 */
export const MAX_GIFT_LABEL_LENGTH = 120;

export const PAGE_NOT_FOUND_MESSAGE = 'Página não encontrada.';

export const INVALID_BANNER_WINDOW_MESSAGE =
  'O período de exibição do banner termina antes de começar: a data de fim precisa ser posterior a de início.';

export function unknownBannersMessage(ids: readonly string[]): string {
  const alvo = ids.length === 1 ? 'Um banner citado não existe mais' : 'Banners citados não existem mais';

  return `${alvo}. Recarregue a pagina de configuracoes e tente de novo.`;
}

/**
 * Quantos atalhos a fileira da home aceita.
 *
 * Nove e o que cabe numa fileira de desktop sem o círculo encolher abaixo de
 * 88px, que e o ponto em que a foto dentro dele deixa de ser reconhecível —
 * e e o mesmo teto que a home já aplicava as categorias. O limite e de
 * desenho, e por isso mora aqui e não na tela: o décimo atalho não apareceria
 * na loja, e uma lista que aceita o que não mostra e uma armadilha.
 */
export const MAX_SHORTCUTS = 9;

/** Teto do campo `order` do atalho — o mesmo declarado no schema. */
export const MAX_SHORTCUT_ORDER = 9999;

/** O nome embaixo do círculo. Curto porque ele tem a largura do círculo. */
export const MAX_SHORTCUT_LABEL_LENGTH = 32;

/** O destino do atalho, igual ao limite do link do banner. */
export const MAX_SHORTCUT_LINK_LENGTH = 300;

export function unknownShortcutsMessage(ids: readonly string[]): string {
  const alvo = ids.length === 1 ? 'Um atalho citado não existe mais' : 'Atalhos citados não existem mais';

  return `${alvo}. Recarregue a pagina de configuracoes e tente de novo.`;
}
