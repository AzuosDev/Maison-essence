import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useIsSignedIn, useMustChangePassword } from '@/features/admin';

/**
 * `/admin/entrar`: a entrada do painel, que agora e a entrada da loja.
 *
 * ## Por que esta tela deixou de existir
 *
 * Havia duas portas de autenticação — uma pedindo telefone, outra pedindo
 * e-mail — e a diferença entre elas não e do interesse de ninguém que usa a
 * loja. Pior: a dona precisava lembrar qual endereço abria qual formulário,
 * e o painel só respondia a quem já soubesse deste aqui.
 *
 * `/conta/entrar` recebe os dois públicos num campo só. O formato do que e
 * digitado decide: telefone vai para o login do cliente, e-mail para o do
 * painel. O guarda do painel continua mandando para `ROUTES.admin.login`, e
 * este endereço continua existindo — em favoritos, em links antigos, na
 * memória de quem já usou. Ele só não desenha mais um formulário.
 *
 * ## O que atravessa junto
 *
 * O `state.from`, que e a tela do painel que barrou a pessoa. Sem ele, quem
 * foi interrompido em `/admin/pedidos` voltaria para a abertura do painel e
 * teria de se reencontrar sozinho.
 *
 * Quem já tem sessão não passa por lugar nenhum: vai direto para onde
 * queria, ou para a troca da senha temporária, que bloqueia o painel
 * inteiro enquanto durar.
 */

/** O que o guarda do painel guardou antes de mandar para ca. */
interface LocationState {
  from?: string;
}

export default function AdminLoginPage() {
  const location = useLocation();
  const signedIn = useIsSignedIn();
  const mustChangePassword = useMustChangePassword();

  const { from } = (location.state ?? {}) as LocationState;

  if (signedIn) {
    if (mustChangePassword) {
      return <Navigate to={ROUTES.admin.changePassword} replace />;
    }

    return <Navigate to={from ?? ROUTES.admin.root} replace />;
  }

  return (
    <Navigate to={ROUTES.account.login} replace state={from === undefined ? undefined : { from }} />
  );
}
