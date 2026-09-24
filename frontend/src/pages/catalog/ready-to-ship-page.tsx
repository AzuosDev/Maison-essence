import { ROUTES } from '@/app/routes';
import { CatalogView } from './catalog-view';

/**
 * Pronta entrega: `/pronta-entrega`.
 *
 * A bandeira chega como contexto, e não como filtro marcável — e o endereço
 * da página, não uma escolha. Por isso a caixa "somente pronta entrega" não
 * aparece na barra lateral daqui, e "limpar filtros" não tira o cliente
 * desta lista.
 */
export default function ReadyToShipPage() {
  return (
    <CatalogView
      title="Pronta entrega"
      description="O que esta em mãos e sai hoje, sem esperar encomenda."
      breadcrumb={[{ label: 'Início', to: ROUTES.home }, { label: 'Pronta entrega' }]}
      context={{ readyToShip: true }}
      emptyTitle="Nada em pronta entrega agora"
      emptyDescription="O estoque em mãos acabou ou não atende aos filtros escolhidos. Fale com a gente no WhatsApp para encomendar."
    />
  );
}
