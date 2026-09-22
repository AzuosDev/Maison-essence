import { useLocation } from 'react-router-dom';
import { MessageScreen } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/app/routes';

/**
 * A tela que ainda nao existe.
 *
 * Vitrine, pagina de produto, categoria, busca, sacola e paginas
 * institucionais tem endereco desde agora — o cabecalho e o rodape apontam
 * para eles — mas o conteudo entra nos proximos passos. Este placeholder
 * ocupa o lugar deles para que nenhum link da moldura leve a um 404.
 *
 * E uma so para todas: registrar o mesmo modulo em varias rotas mantem um
 * arquivo em vez de seis, e quando cada tela chegar ela substitui a sua
 * entrada no router sem tocar nas outras.
 */
export default function SoonPage() {
  const { pathname } = useLocation();

  return (
    <MessageScreen
      title="Esta pagina esta a caminho"
      description="A moldura da loja ja esta de pe. O conteudo desta tela entra em seguida."
      actions={<ButtonLink to={ROUTES.home}>Voltar ao inicio</ButtonLink>}
      {...(import.meta.env.DEV ? { details: `Rota reservada: ${pathname}` } : {})}
    />
  );
}
