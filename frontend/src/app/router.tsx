import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AccountLayout, AdminLayout, StoreLayout } from './layouts';
import { RouteErrorBoundary } from './route-error-boundary';
import { ROUTE_GROUPS } from './routes';

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

    // Os enderecos que a moldura ja aponta e cujas telas entram nos proximos
    // passos. Existem agora para que nenhum link do cabecalho ou do rodape
    // caia num 404 — o placeholder e o mesmo modulo para todos, e cada rota
    // troca a sua entrada quando a tela dela chegar.
    ...soonRoutes([
      '/produtos',
      '/produtos/:slug',
      '/pronta-entrega',
      '/categorias/:slug',
      '/busca',
      '/sacola',
      '/institucional/:slug',
    ]),

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
  ],
};

const adminRoutes: RouteObject = {
  path: ROUTE_GROUPS.admin,
  Component: AdminLayout,
  ErrorBoundary: RouteErrorBoundary,
  children: [
    {
      index: true,
      lazy: page(() => import('@/pages/admin/admin-home-page')),
      ErrorBoundary: RouteErrorBoundary,
    },
  ],
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

export const router = createBrowserRouter([...devRoutes, storeRoutes, accountRoutes, adminRoutes]);
