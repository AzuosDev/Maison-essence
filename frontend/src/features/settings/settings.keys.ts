/**
 * As chaves de cache das configurações.
 *
 * Duas, e só duas: as configurações e a lista de páginas institucionais. São
 * as respostas que a moldura da loja consome em toda página.
 */
export const settingsKeys = {
  all: ['settings'] as const,

  settings: () => [...settingsKeys.all, 'store'] as const,
  pages: () => [...settingsKeys.all, 'pages'] as const,
  page: (slug: string) => [...settingsKeys.pages(), slug] as const,
} as const;
