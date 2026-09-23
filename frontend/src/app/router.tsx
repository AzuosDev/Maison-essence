import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AccountLayout, AdminLayout, StoreLayout } from './layouts';
import { RouteErrorBoundary } from './route-error-boundary';
import { ROUTE_GROUPS, ROUTES } from './routes';

/**
 * O mapa da aplicacao.
 *
 * Tres grupos, e a separacao e mais que organizacao de pastas.
 *
 * - **Loja** (`/`): publica, indexavel, e a unica que o cliente encontra pelo
 *   Google.
 * - **Conta** (`/conta`): a mesma moldura da loja, mas exige sessao de
 *   cliente.
 * - **Painel** (`/painel`): outra moldura, outra sessao, outro publico.
 *
 * Cada grupo tem o seu layout e o seu `errorElement`, e cada pagina tambem
 * tem o seu: um erro na pagina do produto nao pode apagar a loja inteira.
 *
 * ## Carregamento sob demanda
 *
 * Toda pagina entra por `lazy`, e nenhuma e importada no topo deste arquivo.
 * O motivo e direto: o painel administrativo tem tabela, formulario e
 * upload, e nada disso pode pesar no primeiro acesso de quem abriu a loja no
 * celular para ver um perfume. Os layouts, sim, vem no bundle inicial — sao
 * pequenos e todo mundo precisa de um deles.
 */

/**
 * Uma pagina carregada sob demanda.
 *
 * O `lazy` do React Router espera um modulo com `Component`; as paginas
 * exportam `default`, como e a convencao. Esta funcao faz a traducao em um
 * lugar so, em vez de repetir o `.then(...)` em cada rota.
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

    // A listagem: quatro enderecos, uma tela. O que muda entre eles e o
    // cabecalho e o contexto — a categoria fixa, a bandeira fixa, o termo
    // buscado —, e cada modulo abaixo e so isso. O miolo mora em
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

    // A pagina do produto, logo abaixo das listagens que levam a ela. A
    // ordem no arquivo nao muda o casamento das rotas — quem decide e a
    // especificidade do caminho —, mas segue a ordem em que o cliente
    // navega, que e como a proxima pessoa vai procurar aqui dentro.
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
    // por `lazy` como todas as outras: `zod` e os quatro passos so sao
    // baixados por quem chega a esta tela, e nao por quem abriu a home.
    {
      path: '/checkout',
      lazy: page(() => import('@/pages/checkout/checkout-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // A confirmacao, logo depois do checkout que leva a ela. Fica no grupo
    // da loja, e nao em `/conta`, porque o pedido de convidado termina aqui
    // do mesmo jeito que o do cliente cadastrado.
    {
      path: '/pedido/:code',
      lazy: page(() => import('@/pages/order/order-confirmation-page')),
      ErrorBoundary: RouteErrorBoundary,
    },

    // Os enderecos que a moldura ja aponta e cujas telas entram nos proximos
    // passos. Existem agora para que nenhum link do cabecalho ou do rodape
    // caia num 404 — o placeholder e o mesmo modulo para todos, e cada rota
    // troca a sua entrada quando a tela dela chegar.
    ...soonRoutes(['/institucional/:slug']),

    {
      // O curinga fica no grupo da loja de proposito: e ele que pega
      // qualquer endereco desconhecido da aplicacao, inclusive os que comecam
      // com `/conta` ou `/painel` e nao casam com nenhuma rota de la.
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
    // contrario do painel, onde as telas de acesso ficam de fora. La a
    // moldura contem o guarda que manda quem nao tem sessao para o login, e
    // o login dentro dela se mandaria para si mesmo. Aqui nao ha guarda
    // nenhum: a moldura so esconde a saudacao e o menu quando nao ha sessao,
    // e as duas telas de acesso sao paginas da loja como qualquer outra.
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
 * moldura do painel, e nao e organizacao: a moldura contem o guarda que
 * manda quem nao tem sessao para a tela de entrada. Com a entrada dentro
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

        // As areas que o menu ja lista e cujas telas entram nos proximos
        // passos. Existem agora para que um item do menu nunca jogue a dona
        // para fora do painel, na tela de 404 da loja.
        ...adminSoonRoutes([
          'produtos',
          'categorias',
          'pronta-entrega',
          'pedidos',
          'entrega',
          'pagamento',
          'configuracoes',
        ]),

        // A area de sistema, do SUPER_ADMIN. Fica dentro da moldura do
        // painel — e nao num grupo proprio — porque quem chega aqui sem o
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

function adminSoonRoutes(paths: readonly string[]): RouteObject[] {
  return paths.map((path) => ({
    path,
    lazy: page(() => import('@/pages/admin/admin-soon-page')),
    ErrorBoundary: RouteErrorBoundary,
  }));
}

/**
 * O endereco antigo do painel.
 *
 * `/painel` respondia por ele ate agora, e pode estar salvo no navegador de
 * quem ja usou. Redireciona em vez de responder 404 — inclusive os caminhos
 * abaixo dele, que vao todos para a abertura.
 */
const adminLegacyRoutes: RouteObject = {
  path: ROUTE_GROUPS.adminLegacy,
  ErrorBoundary: RouteErrorBoundary,
  children: [{ path: '*', element: <Navigate to={ROUTES.admin.root} replace /> }],
};

/**
 * O styleguide, so em desenvolvimento.
 *
 * O `import.meta.env.DEV` vira `false` literal no build de producao, e com
 * isso o ternario inteiro morre na analise estatica do Rollup: o `import()`
 * some junto, e a pagina nao vira nem um chunk carregado sob demanda. Uma
 * rota escondida atras de um `if` dentro do componente teria o efeito
 * contrario — o codigo continuaria no bundle, so que inalcancavel.
 *
 * Fica fora dos tres grupos porque nao pertence a nenhum: nao e loja, nao e
 * conta e nao e painel. E uma bancada de trabalho, com moldura propria.
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
