import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { MessageScreen } from '@/components/store';
import { Button, ButtonLink } from '@/components/ui';
import { ApiError, NetworkError } from '@/lib/http';
import { ROUTES } from './routes';

/**
 * O que aparece quando uma rota quebra.
 *
 * Registrado como `errorElement` em cada rota, e não só uma vez na raiz — e a
 * diferença importa: um erro na página do produto troca o miolo da página e
 * deixa o cabeçalho, o rodapé e a sacola de pé, em vez de apagar a loja
 * inteira e levar o cliente para uma tela branca. Quem esta comprando
 * continua tendo por onde sair.
 *
 * O React Router captura aqui tanto o erro de renderização quanto o que o
 * carregamento da rota lançar — inclusive o `import()` do lazy que falha
 * porque a conexão caiu no meio.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const { title, description } = describe(error);

  return (
    <MessageScreen
      code="Erro"
      title={title}
      description={description}
      actions={
        <>
          {/* `navigate(0)` recarrega só a rota, sem recarregar o documento:
              o que estava na sacola continua na sacola. */}
          <Button
            onClick={() => {
              void navigate(0);
            }}
          >
            Tentar de novo
          </Button>
          <ButtonLink to={ROUTES.home} variant="secondary">
            Voltar a loja
          </ButtonLink>
        </>
      }
      // O detalhe técnico só em desenvolvimento: em produção ele não ajuda
      // quem esta comprando e ainda conta mais do que deveria sobre a API.
      {...(import.meta.env.DEV ? { details: technicalDetails(error) } : {})}
    />
  );
}

/**
 * A frase que o cliente lê, pelo tipo de erro.
 *
 * Nenhuma delas culpa quem esta lendo, e todas dizem o que fazer a seguir.
 */
function describe(error: unknown): { title: string; description: string } {
  if (error instanceof NetworkError) {
    return {
      title: 'Sem conexão com a loja',
      description: error.message,
    };
  }

  if (error instanceof ApiError) {
    if (error.isAuthError) {
      return {
        title: 'Sua sessão expirou',
        description: 'Entre de novo para continuar de onde parou.',
      };
    }

    return {
      title: 'Não foi possível carregar esta página',
      description: error.messages[0] ?? 'Tente novamente em instantes.',
    };
  }

  // Resposta de rota do próprio React Router (`throw new Response(...)`).
  if (isRouteErrorResponse(error)) {
    return {
      title: 'Não foi possível carregar esta página',
      description: `O servidor respondeu ${error.status}. Tente novamente em instantes.`,
    };
  }

  return {
    title: 'Algo deu errado',
    description: 'Tente novamente. Se continuar assim, fale com a gente pelo WhatsApp.',
  };
}

function technicalDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  return String(error);
}
