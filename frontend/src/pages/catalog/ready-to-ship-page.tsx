import { ROUTES } from '@/app/routes';
import { CatalogView } from './catalog-view';

/**
 * Pronta entrega: `/pronta-entrega`.
 *
 * A bandeira chega como contexto, e nao como filtro marcavel — e o endereco
 * da pagina, nao uma escolha. Por isso a caixa "somente pronta entrega" nao
 * aparece na barra lateral daqui, e "limpar filtros" nao tira o cliente
 * desta lista.
 */
export default function ReadyToShipPage() {
  return (
    <CatalogView
      title="Pronta entrega"
      description="O que esta em maos e sai hoje, sem esperar encomenda."
      breadcrumb={[{ label: 'Inicio', to: ROUTES.home }, { label: 'Pronta entrega' }]}
      context={{ readyToShip: true }}
      emptyTitle="Nada em pronta entrega agora"
      emptyDescription="O estoque em maos acabou ou nao atende aos filtros escolhidos. Fale com a gente no WhatsApp para encomendar."
    />
  );
}
