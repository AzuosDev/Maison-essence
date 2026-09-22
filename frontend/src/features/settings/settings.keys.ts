/**
 * As chaves de cache das configuracoes.
 *
 * Duas, e so duas: as configuracoes e a lista de paginas institucionais. Sao
 * as respostas que a moldura da loja consome em toda pagina.
 */
export const settingsKeys = {
  all: ['settings'] as const,

  settings: () => [...settingsKeys.all, 'store'] as const,
  pages: () => [...settingsKeys.all, 'pages'] as const,
  page: (slug: string) => [...settingsKeys.pages(), slug] as const,
} as const;
