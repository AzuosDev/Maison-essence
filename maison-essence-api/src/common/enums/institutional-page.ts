/**
 * Paginas institucionais. O slug e fixo porque o link e compartilhado no
 * WhatsApp e no rodape: a dona edita titulo e conteudo, nunca o endereco.
 */
export const INSTITUTIONAL_PAGE_SLUGS = {
  ABOUT: 'quem-somos',
  RETURNS: 'trocas-e-devolucoes',
  FAQ: 'perguntas-frequentes',
  HOW_TO_BUY: 'como-comprar',
  PRIVACY: 'politica-de-privacidade',
} as const;

export type InstitutionalPageSlug =
  (typeof INSTITUTIONAL_PAGE_SLUGS)[keyof typeof INSTITUTIONAL_PAGE_SLUGS];

export const INSTITUTIONAL_PAGE_SLUG_VALUES: readonly InstitutionalPageSlug[] =
  Object.values(INSTITUTIONAL_PAGE_SLUGS);
