import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MessageScreen } from '@/components/store';
import { Button } from '@/components/ui';

/**
 * A ultima rede, acima do router.
 *
 * O `errorElement` de cada rota cobre o que acontece dentro da rota. O que
 * quebra fora dela — um provider, o proprio router — passaria direto e
 * deixaria a pagina em branco. Este boundary fica em volta de tudo.
 *
 * E uma classe porque so classe pode ser um error boundary: `componentDidCatch`
 * e `getDerivedStateFromError` nao tem equivalente em hook, e nao e esquecimento
 * da API — o React precisa do ciclo de vida para decidir o que remontar.
 */
interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sem servico de monitoramento ainda: o console e o que ha. Quando
    // entrar um (Sentry e afins), e esta a linha que vira o envio.
    console.error('Erro não tratado na aplicação', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <MessageScreen
        code="Erro"
        title="Algo deu errado"
        description="A página precisa ser recarregada para continuar."
        actions={
          <Button
            onClick={() => {
              // Recarga completa, e nao `setState({ error: null })`: o erro
              // veio de fora do router, e o estado que o causou continuaria
              // ali. Recomecar do zero e o unico jeito honesto.
              window.location.reload();
            }}
          >
            Recarregar a página
          </Button>
        }
        {...(import.meta.env.DEV ? { details: error.stack ?? error.message } : {})}
      />
    );
  }
}
