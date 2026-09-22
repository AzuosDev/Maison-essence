/**
 * Os enderecos da aplicacao, em um lugar so.
 *
 * Nenhum `<Link to="/conta/pedidos">` escrito a mao: string de rota espalhada
 * pelo codigo e o tipo de coisa que continua compilando depois de a rota
 * mudar de nome, e so quebra no clique. Com as constantes, renomear um
 * caminho e uma edicao neste arquivo.
 *
 * Em portugues porque a URL e parte do que o cliente le e do que o Google
 * indexa: `/produtos/asad-lattafa` diz mais que `/products/asad-lattafa` para
 * quem compra aqui. Os identificadores do codigo seguem em ingles, como no
 * resto do projeto.
 */

/** As raizes dos tres grupos de rota. */
export const ROUTE_GROUPS = {
  /** A loja publica. */
  store: '/',
  /** A conta do cliente. */
  account: '/conta',
  /** O painel administrativo. */
  admin: '/painel',
} as const;

export const ROUTES = {
  home: ROUTE_GROUPS.store,

  /** A vitrine inteira, com os filtros na query string. */
  products: '/produtos',
  product: (slug: string) => `/produtos/${slug}`,

  /**
   * Pronta entrega tem endereco proprio, e nao `?readyToShip=true`.
   *
   * E um item de menu e o argumento de venda mais forte da loja — o link
   * limpo e o que se manda no WhatsApp. O filtro equivalente continua
   * existindo na vitrine para quem chega por ela.
   */
  readyToShip: '/pronta-entrega',

  category: (slug: string) => `/categorias/${slug}`,

  /** A busca, com o termo em `?q=`. */
  search: '/busca',
  searchFor: (term: string) => `/busca?q=${encodeURIComponent(term)}`,

  /** A sacola. */
  cart: '/sacola',

  /** Paginas institucionais: `quem-somos`, `trocas-e-devolucoes`... */
  page: (slug: string) => `/institucional/${slug}`,

  account: {
    root: ROUTE_GROUPS.account,
  },

  admin: {
    root: ROUTE_GROUPS.admin,
  },
} as const;
