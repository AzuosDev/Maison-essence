import { useLocation } from 'react-router-dom';
import { EmptyState } from '@/components/ui';

/**
 * A area do painel que ainda nao tem tela.
 *
 * Existe para que um item do menu nunca jogue a dona para fora do painel, na
 * tela de 404 da loja. Diz qual area e — o menu ja esta aberto ao lado, e uma
 * caixa generica de "em breve" faria duvidar do clique.
 *
 * Cada rota troca esta entrada quando a tela dela chegar.
 */
export default function AdminSoonPage() {
  const { pathname } = useLocation();

  return (
    <EmptyState
      title={`${areaLabel(pathname)} entra em seguida`}
      description="Esta area do painel esta sendo construida. As demais continuam funcionando normalmente."
    />
  );
}

/** O nome da area, tirado do proprio endereco. */
function areaLabel(pathname: string): string {
  const labels: Record<string, string> = {
    'pronta-entrega': 'Pronta entrega',
    pagamento: 'Pagamento',
    configuracoes: 'Configuracoes',
  };

  const last = pathname.split('/').findLast((part) => part !== '') ?? '';

  return labels[last] ?? 'Esta area';
}
