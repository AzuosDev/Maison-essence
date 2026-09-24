/**
 * Os endereços da aplicação, em um lugar só.
 *
 * Nenhum `<Link to="/conta/pedidos">` escrito a mão: string de rota espalhada
 * pelo código e o tipo de coisa que continua compilando depois de a rota
 * mudar de nome, e só quebra no clique. Com as constantes, renomear um
 * caminho e uma edição neste arquivo.
 *
 * Em português porque a URL e parte do que o cliente lê e do que o Google
 * indexa: `/produtos/asad-lattafa` diz mais que `/products/asad-lattafa` para
 * quem compra aqui. Os identificadores do código seguem em inglês, como no
 * resto do projeto.
 */

/** As raizes dos três grupos de rota. */
export const ROUTE_GROUPS = {
  /** A loja publica. */
  store: '/',
  /** A conta do cliente. */
  account: '/conta',
  /**
   * O painel administrativo.
   *
   * `/admin`, e não `/painel` como as outras raizes: o endereço do painel
   * não e lido por cliente nenhum e não vai para o Google — quem o digita e
   * a dona, e e `/admin` que ela vai tentar. O endereço antigo continua
   * respondendo, redirecionado, para não quebrar o que já estiver salvo nos
   * favoritos de quem usou a versão anterior.
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
   * Pronta entrega tem endereço próprio, e não `?readyToShip=true`.
   *
   * E um item de menu e o argumento de venda mais forte da loja — o link
   * limpo e o que se manda no WhatsApp. O filtro equivalente continua
   * existindo na vitrine para quem chega por ela.
   */
  readyToShip: '/pronta-entrega',

  /**
   * A vitrine já filtrada por uma marca.
   *
   * `marca`, e não `brand`: o nome do parâmetro e o que a vitrine lê da URL
   * (ver `KEYS` em `catalog.filters`). Escrito a mão com o nome errado, o
   * link não quebra — abre a vitrine inteira, sem filtro e sem aviso, e o
   * cliente que clicou em "ver tudo de Lattafa" cai no catálogo todo.
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
   * Existe aqui antes da tela porque a página do produto já aponta para ele:
   * o "Comprar agora" põe o item na sacola e manda o cliente direto para
   * este endereço, sem a parada intermediaria.
   */
  checkout: '/checkout',

  /**
   * A confirmação de um pedido, pelo código.
   *
   * Fora de `/conta` de propósito: quem compra como convidado também fecha
   * pedido, e um endereço sob a área logada sugeriria que e preciso ter conta
   * para ver o que acabou de acontecer. `/pedido/ME-260922-4KP1` também e um
   * endereço que o cliente entende ao ver.
   */
  order: (code: string) => `/pedido/${encodeURIComponent(code)}`,

  /** Páginas institucionais: `quem-somos`, `trocas-e-devolucoes`... */
  page: (slug: string) => `/institucional/${slug}`,

  account: {
    root: ROUTE_GROUPS.account,

    /** O perfil: nome, e-mail e o telefone que identifica a conta. */
    profile: ROUTE_GROUPS.account,

    /**
     * A entrada, e a única da aplicação inteira.
     *
     * `entrar`, e não `login`, como todo o resto dos endereços que o cliente
     * lê. Atende os dois públicos num campo só: o cliente se identifica pelo
     * celular dos pedidos, quem trabalha na loja pelo e-mail do acesso, e o
     * formato do que foi digitado decide para qual login a tentativa vai.
     *
     * As sessões continuam separadas — tokens, armazenamentos e limites de
     * tentativa diferentes. O que deixou de ser separado e a porta:
     * `ROUTES.admin.login` ainda existe e redireciona para ca.
     */
    login: `${ROUTE_GROUPS.account}/entrar`,

    /** A lista de pedidos da conta. */
    orders: `${ROUTE_GROUPS.account}/pedidos`,

    /**
     * Um pedido da conta, pelo código.
     *
     * Pelo código e não pelo id porque `ME-260922-4KP1` e o que o cliente tem
     * a mão: esta na mensagem que ele mandou para a loja e no comprovante que
     * guardou. E a mesma chave que `GET /customer/orders/:code` espera.
     *
     * Não confunda com `/pedido/:code`, fora da conta: aquele e a confirmação
     * do que acabou de ser fechado, lida do próprio navegador, e existe para
     * quem comprou como convidado. Este lê do servidor e mostra o histórico.
     */
    order: (code: string) => `${ROUTE_GROUPS.account}/pedidos/${encodeURIComponent(code)}`,

    /** Os endereços salvos. */
    addresses: `${ROUTE_GROUPS.account}/enderecos`,

    /** O cadastro. */
    register: `${ROUTE_GROUPS.account}/criar`,

    /**
     * O cadastro com o telefone já preenchido.
     *
     * A confirmação do pedido oferece a conta a quem comprou como convidado,
     * e o telefone que ela leva e o mesmo do pedido — e por ele que o
     * servidor liga as compras anteriores a conta nova. Pedir o número de
     * novo, na tela seguinte, só criaria a chance de ele ser digitado
     * diferente.
     */
    registerWith: (phone: string) =>
      `${ROUTE_GROUPS.account}/criar?telefone=${encodeURIComponent(phone)}`,
  },

  /**
   * O painel, tela a tela.
   *
   * Em português como o resto dos endereços, e por um motivo prático: a dona
   * lê a barra de endereços quando manda um link para quem ajuda no
   * atendimento. `/admin/pedidos/ME-1042` diz o que e; `/admin/orders/...`
   * pediria tradução.
   */
  admin: {
    root: ROUTE_GROUPS.admin,

    /**
     * A entrada do painel, que hoje só redireciona.
     *
     * O formulário e um só, em `ROUTES.account.login`, e atende os dois
     * públicos. Este endereço fica porque o guarda do painel manda para ele
     * e porque esta salvo no navegador de quem já usou — e leva o `from`
     * junto, para que a pessoa volte a tela que a barrou.
     */
    login: `${ROUTE_GROUPS.admin}/entrar`,

    /** A troca obrigatória da senha temporária. */
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
     * A área de sistema, do SUPER_ADMIN.
     *
     * `/admin/system` em inglês, e não `/admin/sistema` como o resto: não e
     * inconsistência, e destino. Os endereços em português existem porque a
     * dona os lê — ela manda `/admin/pedidos/ME-1042` para quem ajuda no
     * atendimento. Esta área ela não abre, não vê no menu e não manda para
     * ninguém; quem digita aqui e quem mantem a aplicação. As três telas
     * abaixo seguem em português porque são lidas nas abas da própria área.
     */
    system: `${ROUTE_GROUPS.admin}/system`,
    systemAudit: `${ROUTE_GROUPS.admin}/system/auditoria`,
    systemHealth: `${ROUTE_GROUPS.admin}/system/saude`,
  },
} as const;
