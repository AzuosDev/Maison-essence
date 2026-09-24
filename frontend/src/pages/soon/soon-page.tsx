import { useLocation } from 'react-router-dom';
import { MessageScreen } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/app/routes';

/**
 * A tela que ainda não existe.
 *
 * Vitrine, página de produto, categoria, busca, sacola e páginas
 * institucionais tem endereço desde agora — o cabeçalho e o rodapé apontam
 * para eles — mas o conteúdo entra nos próximos passos. Este placeholder
 * ocupa o lugar deles para que nenhum link da moldura leve a um 404.
 *
 * E uma só para todas: registrar o mesmo módulo em várias rotas mantem um
 * arquivo em vez de seis, e quando cada tela chegar ela substitui a sua
 * entrada no router sem tocar nas outras.
 */
export default function SoonPage() {
  const { pathname } = useLocation();

  return (
    <MessageScreen
      title="Esta página esta a caminho"
      description="A moldura da loja já esta de pé. O conteúdo desta tela entra em seguida."
      actions={<ButtonLink to={ROUTES.home}>Voltar ao início</ButtonLink>}
      {...(import.meta.env.DEV ? { details: `Rota reservada: ${pathname}` } : {})}
    />
  );
}
