import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageScreen } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/app/routes';

/**
 * O endereco que nao existe.
 *
 * Registrada no grupo da loja, e por isso qualquer endereco desconhecido —
 * inclusive dentro de `/conta` ou `/painel` — cai aqui dentro do cabecalho e
 * do rodape da loja, com uma saida a mao. E o oposto da tela branca com
 * "Cannot GET /".
 *
 * Nao ha como um SPA devolver 404 de verdade: o servidor entrega o mesmo
 * `index.html` para toda rota, com status 200. O que da para fazer, e esta
 * feito, e marcar a pagina como `noindex` para que o Google nao guarde um
 * endereco quebrado como se fosse pagina da loja.
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
      description="O endereço pode ter mudado, ou o produto saiu do catalogo. A vitrine continua logo ali."
      actions={<ButtonLink to={ROUTES.home}>Voltar a loja</ButtonLink>}
      {...(import.meta.env.DEV ? { details: `Endereço pedido: ${pathname}` } : {})}
    />
  );
}
