import { Suspense, lazy, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { registerSessions } from '@/features/auth';
import { AppErrorBoundary } from './app-error-boundary';
import { createQueryClient } from './query-client';

/**
 * Tudo o que envolve a aplicacao inteira.
 *
 * O registro das sessoes acontece no escopo do modulo, antes de qualquer
 * componente renderizar — e nao dentro de um `useEffect`. Um efeito roda
 * depois do primeiro render, e uma requisicao disparada nesse intervalo
 * sairia sem token e, pior, sem conseguir renovar: o cliente HTTP nao acharia
 * o `SessionPort` e trataria o `401` como sessao inexistente.
 */
registerSessions();

/**
 * O inspetor de cache do TanStack Query.
 *
 * Carregado sob demanda e so em desenvolvimento: com o `import()` dentro do
 * `import.meta.env.DEV`, o bundle de producao nem chega a conter o modulo —
 * sao algumas dezenas de KB que o cliente nao baixa.
 */
const Devtools = import.meta.env.DEV
  ? lazy(async () => ({
      default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
    }))
  : null;

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Criado uma vez, dentro do componente. Em modulo, o cache sobreviveria ao
  // hot reload com dados de antes da mudanca; aqui ele nasce e morre junto
  // com a aplicacao.
  const [queryClient] = useState(createQueryClient);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}

        {Devtools ? (
          <Suspense fallback={null}>
            <Devtools buttonPosition="bottom-left" />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
