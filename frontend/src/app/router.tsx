import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AccountLayout, AdminLayout, StoreLayout } from './layouts';
import { RouteErrorBoundary } from './route-error-boundary';
import { ROUTE_GROUPS, ROUTES } from './routes';

/**
 * O mapa da aplicação.
 *
 * Três grupos, e a separação e mais que organização de pastas.
 *
 * - **Loja** (`/`): publica, indexável, e a única que o cliente encontra pelo
 *   Google.
 * - **Conta** (`/conta`): a mesma moldura da loja, mas exige sessão de
 *   cliente.
 * - **Painel** (`/painel`): outra moldura, outra sessão, outro público.
 *
 * Cada grupo tem o seu layout e o seu `errorElement`, e cada página também
 * tem o seu: um erro na página do produto não pode apagar a loja inteira.
 *
 * ## Carregamento sob demanda
 *
 * Toda página entra por `lazy`, e nenhuma e importada no topo deste arquivo.
 * O motivo e direto: o painel administrativo tem tabela, formulário e
 * upload, e nada disso pode pesar no primeiro acesso de quem abriu a loja no
 * celular para ver um perfume. Os layouts, sim, vem no bundle inicial — são
 * pequenos e todo mundo precisa de um deles.
 */

/**
 * Uma página carregada sob demanda.
 *
 * O `lazy` do React Router espera um módulo com `Component`; as páginas
 * exportam `default`, como e a convenção. Esta função faz a tradução em um
 * lugar só, em vez de repetir o `.then(...)` em cada rota.
 */
function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default });
}

const storeRoutes: RouteObject = {
  path: ROUTE_GROUPS.store,
  Component: StoreLayout,
  ErrorBoundary: RouteErrorBoundary,
  children: [
    {
      index: true,
      lazy: page(() => import('@/pages/home/home-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // A listagem: quatro endereços, uma tela. O que muda entre eles e o
    // cabeçalho e o contexto — a categoria fixa, a bandeira fixa, o termo
    // buscado —, e cada módulo abaixo e só isso. O miolo mora em
    // `pages/catalog/catalog-view`, que os quatro compartilham.
    {
      path: '/produtos',
      lazy: page(() => import('@/pages/catalog/products-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: '/pronta-entrega',
      lazy: page(() => import('@/pages/catalog/ready-to-ship-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: '/categorias/:slug',
      lazy: page(() => import('@/pages/catalog/category-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: '/busca',
      lazy: page(() => import('@/pages/catalog/search-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // A página do produto, logo abaixo das listagens que levam a ela. A
    // ordem no arquivo não muda o casamento das rotas — quem decide e a
    // especificidade do caminho —, mas segue a ordem em que o cliente
    // navega, que e como a próxima pessoa vai procurar aqui dentro.
    {
      path: '/produtos/:slug',
      lazy: page(() => import('@/pages/product/product-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    {
      path: '/sacola',
      lazy: page(() => import('@/pages/cart/cart-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // O fechamento do pedido, logo depois da sacola que leva a ele. Entra
    // por `lazy` como todas as outras: `zod` e os quatro passos só são
    // baixados por quem chega a esta tela, e não por quem abriu a home.
    {
      path: '/checkout',
      lazy: page(() => import('@/pages/checkout/checkout-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // A confirmação, logo depois do checkout que leva a ela. Fica no grupo
    // da loja, e não em `/conta`, porque o pedido de convidado termina aqui
    // do mesmo jeito que o do cliente cadastrado.
    {
      path: '/pedido/:code',
      lazy: page(() => import('@/pages/order/order-confirmation-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // Os endereços que a moldura já aponta e cujas telas entram nos próximos
    // passos. Existem agora para que nenhum link do cabeçalho ou do rodapé
    // caia num 404 — o placeholder e o mesmo módulo para todos, e cada rota
    // troca a sua entrada quando a tela dela chegar.
    ...soonRoutes(['/institucional/:slug']),

    {
      // O curinga fica no grupo da loja de propósito: e ele que pega
      // qualquer endereço desconhecido da aplicação, inclusive os que começam
      // com `/conta` ou `/painel` e não casam com nenhuma rota de lá.
      path: '*',
      lazy: page(() => import('@/pages/not-found/not-found-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
  ],
};

function soonRoutes(paths: readonly string[]): RouteObject[] {
  return paths.map((path) => ({
    path,
    lazy: page(() => import('@/pages/soon/soon-page')),
    ErrorBoundary: RouteErrorBoundary,
  }));
}

const accountRoutes: RouteObject = {
  path: ROUTE_GROUPS.account,
  Component: AccountLayout,
  ErrorBoundary: RouteErrorBoundary,
  children: [
    {
      index: true,
      lazy: page(() => import('@/pages/account/account-home-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // Entrar e criar conta ficam **dentro** da moldura da conta, ao
    // contrário do painel, onde as telas de acesso ficam de fora. La a
    // moldura contem o guarda que manda quem não tem sessão para o login, e
    // o login dentro dela se mandaria para si mesmo. Aqui não há guarda
    // nenhum: a moldura só esconde a saudação e o menu quando não há sessão,
    // e as duas telas de acesso são páginas da loja como qualquer outra.
    {
      path: 'entrar',
      lazy: page(() => import('@/pages/account/account-login-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: 'criar',
      lazy: page(() => import('@/pages/account/account-register-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    {
      path: 'pedidos',
      lazy: page(() => import('@/pages/account/account-orders-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: 'pedidos/:code',
      lazy: page(() => import('@/pages/account/account-order-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: 'enderecos',
      lazy: page(() => import('@/pages/account/account-addresses-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
  ],
};

/**
 * O painel.
 *
 * As duas telas de acesso — entrar e trocar a senha — ficam **fora** da
 * moldura do painel, e não e organização: a moldura contem o guarda que
 * manda quem não tem sessão para a tela de entrada. Com a entrada dentro
 * dela, o guarda mandaria a tela de entrada para a tela de entrada, para
 * sempre.
 */
const adminRoutes: RouteObject = {
  path: ROUTE_GROUPS.admin,
  ErrorBoundary: RouteErrorBoundary,
  children: [
    {
      path: 'entrar',
      lazy: page(() => import('@/pages/admin/admin-login-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
    {
      path: 'trocar-senha',
      lazy: page(() => import('@/pages/admin/admin-change-password-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    {
      Component: AdminLayout,
      ErrorBoundary: RouteErrorBoundary,
      children: [
        {
          index: true,
          lazy: page(() => import('@/pages/admin/admin-home-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        // Os pedidos: a lista e o detalhe. A lista lê o recorte do próprio
        // endereço (`?status=...`), e por isso o card da abertura consegue
        // apontar para um filtro; o detalhe entra por id, e não por código,
        // porque e o id que as rotas administrativas do backend aceitam.
        {
          path: 'pedidos',
          lazy: page(() => import('@/pages/admin/admin-orders-page')),
          ErrorBoundary: RouteErrorBoundary,
        },
        {
          path: 'pedidos/:id',
          lazy: page(() => import('@/pages/admin/admin-order-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        // O catálogo: a lista e o cadastro. `novo` e um literal e por isso
        // vem antes de `:id` — o React Router casa o caminho mais específico
        // primeiro, mas a ordem declarada e o que a próxima pessoa lê.
        {
          path: 'produtos',
          lazy: page(() => import('@/pages/admin/admin-products-page')),
          ErrorBoundary: RouteErrorBoundary,
        },
        {
          path: 'produtos/novo',
          lazy: page(() => import('@/pages/admin/admin-product-form-page')),
          ErrorBoundary: RouteErrorBoundary,
        },
        {
          path: 'produtos/:id',
          lazy: page(() => import('@/pages/admin/admin-product-form-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        {
          path: 'categorias',
          lazy: page(() => import('@/pages/admin/admin-categories-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        // A tabela de taxas por cidade, e as regras de pagamento. As duas
        // ficam fora do alcance do STAFF pelo próprio backend; as telas
        // repetem o recorte para não pedir o que será recusado.
        {
          path: 'entrega',
          lazy: page(() => import('@/pages/admin/admin-delivery-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        {
          path: 'pagamento',
          lazy: page(() => import('@/pages/admin/admin-payments-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        {
          path: 'configuracoes',
          lazy: page(() => import('@/pages/admin/admin-settings-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        // A prateleira: o catálogo recortado no que esta em pronta entrega.
        // Endereço próprio, e não `produtos?readyToShip`, porque não e um
        // recorte que se experimenta — e um lugar que se confere, e o link
        // dele fica no menu.
        {
          path: 'pronta-entrega',
          lazy: page(() => import('@/pages/admin/admin-ready-to-ship-page')),
          ErrorBoundary: RouteErrorBoundary,
        },

        // A área de sistema, do SUPER_ADMIN. Fica dentro da moldura do
        // painel — e não num grupo próprio — porque quem chega aqui sem o
        // papel precisa continuar a um clique de onde queria ir: o menu
        // permanece ao lado da tela de acesso negado. O recorte por papel e
        // do `SystemLayout`, e o backend recusa de todo jeito.
        {
          path: 'system',
          lazy: page(() => import('@/pages/admin/system/system-layout')),
          ErrorBoundary: RouteErrorBoundary,
          children: [
            {
              index: true,
              lazy: page(() => import('@/pages/admin/system/system-users-page')),
              ErrorBoundary: RouteErrorBoundary,
            },
            {
              path: 'auditoria',
              lazy: page(() => import('@/pages/admin/system/system-audit-page')),
              ErrorBoundary: RouteErrorBoundary,
            },
            {
              path: 'saude',
              lazy: page(() => import('@/pages/admin/system/system-health-page')),
              ErrorBoundary: RouteErrorBoundary,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * O endereço antigo do painel.
 *
 * `/painel` respondia por ele até agora, e pode estar salvo no navegador de
 * quem já usou. Redireciona em vez de responder 404 — inclusive os caminhos
 * abaixo dele, que vão todos para a abertura.
 */
const adminLegacyRoutes: RouteObject = {
  path: ROUTE_GROUPS.adminLegacy,
  ErrorBoundary: RouteErrorBoundary,
  children: [{ path: '*', element: <Navigate to={ROUTES.admin.root} replace /> }],
};

/**
 * O styleguide, só em desenvolvimento.
 *
 * O `import.meta.env.DEV` vira `false` literal no build de produção, e com
 * isso o ternário inteiro morre na análise estática do Rollup: o `import()`
 * some junto, e a página não vira nem um chunk carregado sob demanda. Uma
 * rota escondida atrás de um `if` dentro do componente teria o efeito
 * contrário — o código continuaria no bundle, só que inalcancável.
 *
 * Fica fora dos três grupos porque não pertence a nenhum: não e loja, não e
 * conta e não e painel. E uma bancada de trabalho, com moldura própria.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/styleguide',
        lazy: page(() => import('@/pages/styleguide/styleguide-page')),
        ErrorBoundary: RouteErrorBoundary,
      },
    ]
  : [];

export const router = createBrowserRouter([
  ...devRoutes,
  storeRoutes,
  accountRoutes,
  adminRoutes,
  adminLegacyRoutes,
]);
