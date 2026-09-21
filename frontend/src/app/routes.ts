/**
 * Os enderecos da aplicacao, em um lugar so.
 *
 * Nenhum `<Link to="/conta/pedidos">` escrito a mao: string de rota espalhada
 * pelo codigo e o tipo de coisa que continua compilando depois de a rota
 * mudar de nome, e so quebra no clique. Com as constantes, renomear um
 * caminho e uma edicao neste arquivo.
 *
 * Em portugues porque a URL e parte do que o cliente le e do que o Google
 * indexa: `/produto/asad-lattafa` diz mais que `/product/asad-lattafa` para
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

  account: {
    root: ROUTE_GROUPS.account,
  },

  admin: {
    root: ROUTE_GROUPS.admin,
  },
} as const;
