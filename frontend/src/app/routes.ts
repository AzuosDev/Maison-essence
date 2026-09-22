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
  /**
   * O painel administrativo.
   *
   * `/admin`, e nao `/painel` como as outras raizes: o endereco do painel
   * nao e lido por cliente nenhum e nao vai para o Google — quem o digita e
   * a dona, e e `/admin` que ela vai tentar. O endereco antigo continua
   * respondendo, redirecionado, para nao quebrar o que ja estiver salvo nos
   * favoritos de quem usou a versao anterior.
   */
  admin: '/admin',

  /** Onde o painel morava. Redireciona para `admin`. */
  adminLegacy: '/painel',
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

  /**
   * O fechamento do pedido.
   *
   * Existe aqui antes da tela porque a pagina do produto ja aponta para ele:
   * o "Comprar agora" poe o item na sacola e manda o cliente direto para
   * este endereco, sem a parada intermediaria.
   */
  checkout: '/checkout',

  /**
   * A confirmacao de um pedido, pelo codigo.
   *
   * Fora de `/conta` de proposito: quem compra como convidado tambem fecha
   * pedido, e um endereco sob a area logada sugeriria que e preciso ter conta
   * para ver o que acabou de acontecer. `/pedido/ME-260922-4KP1` tambem e um
   * endereco que o cliente entende ao ver.
   */
  order: (code: string) => `/pedido/${encodeURIComponent(code)}`,

  /** Paginas institucionais: `quem-somos`, `trocas-e-devolucoes`... */
  page: (slug: string) => `/institucional/${slug}`,

  account: {
    root: ROUTE_GROUPS.account,

    /** A lista de pedidos da conta. A tela entra na area do cliente. */
    orders: `${ROUTE_GROUPS.account}/pedidos`,

    /** O cadastro. */
    register: `${ROUTE_GROUPS.account}/criar`,

    /**
     * O cadastro com o telefone ja preenchido.
     *
     * A confirmacao do pedido oferece a conta a quem comprou como convidado,
     * e o telefone que ela leva e o mesmo do pedido — e por ele que o
     * servidor liga as compras anteriores a conta nova. Pedir o numero de
     * novo, na tela seguinte, so criaria a chance de ele ser digitado
     * diferente.
     */
    registerWith: (phone: string) =>
      `${ROUTE_GROUPS.account}/criar?telefone=${encodeURIComponent(phone)}`,
  },

  /**
   * O painel, tela a tela.
   *
   * Em portugues como o resto dos enderecos, e por um motivo pratico: a dona
   * le a barra de enderecos quando manda um link para quem ajuda no
   * atendimento. `/admin/pedidos/ME-1042` diz o que e; `/admin/orders/...`
   * pediria traducao.
   */
  admin: {
    root: ROUTE_GROUPS.admin,

    /** A tela de entrada do painel, fora da moldura logada. */
    login: `${ROUTE_GROUPS.admin}/entrar`,

    /** A troca obrigatoria da senha temporaria. */
    changePassword: `${ROUTE_GROUPS.admin}/trocar-senha`,

    products: `${ROUTE_GROUPS.admin}/produtos`,
    newProduct: `${ROUTE_GROUPS.admin}/produtos/novo`,
    product: (id: string) => `${ROUTE_GROUPS.admin}/produtos/${id}`,

    categories: `${ROUTE_GROUPS.admin}/categorias`,
    readyToShip: `${ROUTE_GROUPS.admin}/pronta-entrega`,

    orders: `${ROUTE_GROUPS.admin}/pedidos`,
    order: (id: string) => `${ROUTE_GROUPS.admin}/pedidos/${id}`,

    delivery: `${ROUTE_GROUPS.admin}/entrega`,
    payments: `${ROUTE_GROUPS.admin}/pagamento`,
    settings: `${ROUTE_GROUPS.admin}/configuracoes`,
  },
} as const;
