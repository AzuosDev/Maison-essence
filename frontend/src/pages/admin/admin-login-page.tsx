import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useIsSignedIn, useMustChangePassword } from '@/features/admin';

/**
 * `/admin/entrar`: a entrada do painel, que agora e a entrada da loja.
 *
 * ## Por que esta tela deixou de existir
 *
 * Havia duas portas de autenticacao — uma pedindo telefone, outra pedindo
 * e-mail — e a diferenca entre elas nao e do interesse de ninguem que usa a
 * loja. Pior: a dona precisava lembrar qual endereco abria qual formulario,
 * e o painel so respondia a quem ja soubesse deste aqui.
 *
 * `/conta/entrar` recebe os dois publicos num campo so. O formato do que e
 * digitado decide: telefone vai para o login do cliente, e-mail para o do
 * painel. O guarda do painel continua mandando para `ROUTES.admin.login`, e
 * este endereco continua existindo — em favoritos, em links antigos, na
 * memoria de quem ja usou. Ele so nao desenha mais um formulario.
 *
 * ## O que atravessa junto
 *
 * O `state.from`, que e a tela do painel que barrou a pessoa. Sem ele, quem
 * foi interrompido em `/admin/pedidos` voltaria para a abertura do painel e
 * teria de se reencontrar sozinho.
 *
 * Quem ja tem sessao nao passa por lugar nenhum: vai direto para onde
 * queria, ou para a troca da senha temporaria, que bloqueia o painel
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
