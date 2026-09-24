import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageScreen } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/app/routes';

/**
 * O endereço que não existe.
 *
 * Registrada no grupo da loja, e por isso qualquer endereço desconhecido —
 * inclusive dentro de `/conta` ou `/painel` — cai aqui dentro do cabeçalho e
 * do rodapé da loja, com uma saída a mão. E o oposto da tela branca com
 * "Cannot GET /".
 *
 * Não há como um SPA devolver 404 de verdade: o servidor entrega o mesmo
 * `index.html` para toda rota, com status 200. O que da para fazer, e esta
 * feito, e marcar a página como `noindex` para que o Google não guarde um
 * endereço quebrado como se fosse página da loja.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = document.createElement('meta');

    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);

  return (
    <MessageScreen
      code="404"
      title="Esta página não existe"
      description="O endereço pode ter mudado, ou o produto saiu do catálogo. A vitrine continua logo ali."
      actions={<ButtonLink to={ROUTES.home}>Voltar a loja</ButtonLink>}
      {...(import.meta.env.DEV ? { details: `Endereço pedido: ${pathname}` } : {})}
    />
  );
}
