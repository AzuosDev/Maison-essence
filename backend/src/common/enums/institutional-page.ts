/**
 * Páginas institucionais. O slug e fixo porque o link e compartilhado no
 * WhatsApp e no rodapé: a dona edita título e conteúdo, nunca o endereço.
 */
export const INSTITUTIONAL_PAGE_SLUGS = {
  ABOUT: 'quem-somos',
  HOW_TO_BUY: 'como-comprar',
  /**
   * Como usar e guardar o perfume.
   *
   * Tem endereço próprio porque e a dúvida de dois momentos diferentes: a aba
   * da página do produto, de quem ainda esta decidindo, e o link do rodapé,
   * de quem já recebeu o frasco em casa.
   */
  USAGE: 'modo-de-uso',
  RETURNS: 'trocas-e-devolucoes',
  FAQ: 'perguntas-frequentes',
  PRIVACY: 'politica-de-privacidade',
} as const;

export type InstitutionalPageSlug =
  (typeof INSTITUTIONAL_PAGE_SLUGS)[keyof typeof INSTITUTIONAL_PAGE_SLUGS];

export const INSTITUTIONAL_PAGE_SLUG_VALUES: readonly InstitutionalPageSlug[] =
  Object.values(INSTITUTIONAL_PAGE_SLUGS);
