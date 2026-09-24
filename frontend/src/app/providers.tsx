import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { watchAccountCache } from '@/features/account/account-session';
import { registerSessions } from '@/features/auth';
import { watchCustomerCart } from '@/features/cart';
import { ThemeProvider } from '@/features/theme';
import { AppErrorBoundary } from './app-error-boundary';
import { createQueryClient } from './query-client';

/**
 * Tudo o que envolve a aplicação inteira.
 *
 * O registro das sessões acontece no escopo do módulo, antes de qualquer
 * componente renderizar — e não dentro de um `useEffect`. Um efeito roda
 * depois do primeiro render, e uma requisição disparada nesse intervalo
 * sairia sem token e, pior, sem conseguir renovar: o cliente HTTP não acharia
 * o `SessionPort` e trataria o `401` como sessão inexistente.
 */
registerSessions();

/**
 * A sacola acompanha quem entra e quem sai.
 *
 * Aqui, e não num efeito, pelo mesmo motivo do registro acima: a sessão pode
 * mudar antes de qualquer componente montar — o cliente HTTP a encerra
 * sozinho quando a renovação falha —, e uma assinatura que só começa depois
 * do primeiro render perderia justamente esse caso.
 */
watchCustomerCart();

/**
 * O inspetor de cache do TanStack Query.
 *
 * Carregado sob demanda e só em desenvolvimento: com o `import()` dentro do
 * `import.meta.env.DEV`, o bundle de produção nem chega a conter o módulo —
 * são algumas dezenas de KB que o cliente não baixa.
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
  // Criado uma vez, dentro do componente. Em módulo, o cache sobreviveria ao
  // hot reload com dados de antes da mudanca; aqui ele nasce e morre junto
  // com a aplicação.
  const [queryClient] = useState(createQueryClient);

  /**
   * O cache da conta acompanha quem esta logado.
   *
   * Aqui, e não no escopo do módulo como as duas assinaturas acima: esta
   * precisa do `queryClient`, que nasce dentro do componente. O que se perde
   * e o intervalo antes do primeiro efeito — e nele não há o que perder,
   * porque um cache recém-criado não tem dado de ninguém.
   */
  useEffect(() => watchAccountCache(queryClient), [queryClient]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/*
          O tema por fora do `ToastProvider`, e por fora de tudo o que
          desenha: quem o troca esta no rodapé, mas quem o le e cada token de
          cor da aplicação. Por dentro, uma tela fora do provedor cairia no
          valor inerte e mostraria "Sistema" marcado mesmo com o escuro
          escolhido.
        */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>

        {Devtools ? (
          <Suspense fallback={null}>
            <Devtools buttonPosition="bottom-left" />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
