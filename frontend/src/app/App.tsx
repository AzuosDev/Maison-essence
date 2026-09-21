import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { router } from './router';

/**
 * A aplicacao: os providers em volta do router, e nada mais.
 *
 * A ordem e a que importa aqui. O `AppErrorBoundary`, dentro de `Providers`,
 * fica por fora do `RouterProvider` — e o que garante que um erro do proprio
 * router ainda encontre uma tela, em vez de deixar a pagina em branco.
 */
export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
