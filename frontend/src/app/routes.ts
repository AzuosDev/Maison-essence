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

  /**
   * A vitrine ja filtrada por uma marca.
   *
   * `marca`, e nao `brand`: o nome do parametro e o que a vitrine le da URL
   * (ver `KEYS` em `catalog.filters`). Escrito a mao com o nome errado, o
   * link nao quebra — abre a vitrine inteira, sem filtro e sem aviso, e o
   * cliente que clicou em "ver tudo de Lattafa" cai no catalogo todo.
   */
  productsByBrand: (brand: string) => `/produtos?marca=${encodeURIComponent(brand)}`,

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

    /** O perfil: nome, e-mail e o telefone que identifica a conta. */
    profile: ROUTE_GROUPS.account,

    /**
     * A entrada, e a unica da aplicacao inteira.
     *
     * `entrar`, e nao `login`, como todo o resto dos enderecos que o cliente
     * le. Atende os dois publicos num campo so: o cliente se identifica pelo
     * celular dos pedidos, quem trabalha na loja pelo e-mail do acesso, e o
     * formato do que foi digitado decide para qual login a tentativa vai.
     *
     * As sessoes continuam separadas — tokens, armazenamentos e limites de
     * tentativa diferentes. O que deixou de ser separado e a porta:
     * `ROUTES.admin.login` ainda existe e redireciona para ca.
     */
    login: `${ROUTE_GROUPS.account}/entrar`,

    /** A lista de pedidos da conta. */
    orders: `${ROUTE_GROUPS.account}/pedidos`,

    /**
     * Um pedido da conta, pelo codigo.
     *
     * Pelo codigo e nao pelo id porque `ME-260922-4KP1` e o que o cliente tem
     * a mao: esta na mensagem que ele mandou para a loja e no comprovante que
     * guardou. E a mesma chave que `GET /customer/orders/:code` espera.
     *
     * Nao confunda com `/pedido/:code`, fora da conta: aquele e a confirmacao
     * do que acabou de ser fechado, lida do proprio navegador, e existe para
     * quem comprou como convidado. Este le do servidor e mostra o historico.
     */
    order: (code: string) => `${ROUTE_GROUPS.account}/pedidos/${encodeURIComponent(code)}`,

    /** Os enderecos salvos. */
    addresses: `${ROUTE_GROUPS.account}/enderecos`,

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

    /**
     * A entrada do painel, que hoje so redireciona.
     *
     * O formulario e um so, em `ROUTES.account.login`, e atende os dois
     * publicos. Este endereco fica porque o guarda do painel manda para ele
     * e porque esta salvo no navegador de quem ja usou — e leva o `from`
     * junto, para que a pessoa volte a tela que a barrou.
     */
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

    /**
     * A area de sistema, do SUPER_ADMIN.
     *
     * `/admin/system` em ingles, e nao `/admin/sistema` como o resto: nao e
     * inconsistencia, e destino. Os enderecos em portugues existem porque a
     * dona os le — ela manda `/admin/pedidos/ME-1042` para quem ajuda no
     * atendimento. Esta area ela nao abre, nao ve no menu e nao manda para
     * ninguem; quem digita aqui e quem mantem a aplicacao. As tres telas
     * abaixo seguem em portugues porque sao lidas nas abas da propria area.
     */
    system: `${ROUTE_GROUPS.admin}/system`,
    systemAudit: `${ROUTE_GROUPS.admin}/system/auditoria`,
    systemHealth: `${ROUTE_GROUPS.admin}/system/saude`,
  },
} as const;
