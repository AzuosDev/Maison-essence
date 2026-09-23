import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { watchAccountCache } from '@/features/account/account-session';
import { registerSessions } from '@/features/auth';
import { watchCustomerCart } from '@/features/cart';
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
 * A sacola acompanha quem entra e quem sai.
 *
 * Aqui, e nao num efeito, pelo mesmo motivo do registro acima: a sessao pode
 * mudar antes de qualquer componente montar — o cliente HTTP a encerra
 * sozinho quando a renovacao falha —, e uma assinatura que so comeca depois
 * do primeiro render perderia justamente esse caso.
 */
watchCustomerCart();

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

  /**
   * O cache da conta acompanha quem esta logado.
   *
   * Aqui, e nao no escopo do modulo como as duas assinaturas acima: esta
   * precisa do `queryClient`, que nasce dentro do componente. O que se perde
   * e o intervalo antes do primeiro efeito — e nele nao ha o que perder,
   * porque um cache recem-criado nao tem dado de ninguem.
   */
  useEffect(() => watchAccountCache(queryClient), [queryClient]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>

        {Devtools ? (
          <Suspense fallback={null}>
            <Devtools buttonPosition="bottom-left" />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
