import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { listOrders, listProducts } from './admin.api';
import { adminKeys } from './admin.keys';
import {
  countSince,
  lowStock,
  outOfStock,
  revenueOf,
  startOfMonth,
  startOfToday,
  type LowStockLine,
  type Revenue,
} from './dashboard';
import { ADMIN_MAX_PAGE_SIZE, ORDER_STATUSES, type AdminOrderSummary } from './admin.types';

/**
 * Os números da abertura do painel.
 *
 * Quatro consultas, e cada uma responde uma pergunta que a dona faz de
 * manha:
 *
 * 1. **O mês** — os pedidos desde o dia primeiro. Dela saem duas respostas:
 *    o faturamento e quantos pedidos entraram hoje, porque os de hoje estão
 *    dentro do mês e a lista vem do mais novo para o mais antigo. Duas
 *    consultas para o mesmo intervalo seriam uma ida a rede a toa.
 * 2. **Pendentes de contato** — só a contagem. `limit: 1` e de propósito: a
 *    resposta que interessa e `totalItems`, e não os pedidos.
 * 3. **Os últimos dez** — a lista que ela realmente abre.
 * 4. **Os produtos** — para o esgotados e o estoque baixo.
 *
 * Quatro `useQuery` fixos, e não um `useQueries` com array: a lista nunca
 * muda de tamanho, e assim cada consulta mantem o tipo dela sem conversão
 * nenhuma no meio do caminho.
 *
 * ## Um minuto de frescor
 *
 * O painel fica aberto o dia inteiro numa aba. Um minuto e curto o bastante
 * para o número acompanhar o expediente e longo o bastante para a tela não
 * repetir quatro consultas a cada troca de aba.
 */
const STALE_TIME_MS = 60_000;

/** Quantos pedidos a lista da abertura mostra. */
const RECENT_COUNT = 10;

export interface Dashboard {
  /** Pedidos criados desde a meia-noite. */
  todayCount: number;
  /** Pedidos esperando o primeiro contato no WhatsApp. */
  pendingCount: number;
  monthRevenue: Revenue;
  /** Produtos publicados sem nenhuma unidade a venda. */
  outOfStockCount: number;
  recentOrders: AdminOrderSummary[];
  lowStock: LowStockLine[];
  isLoading: boolean;
  isError: boolean;
}

export function useDashboard(): Dashboard {
  // Calculados uma vez por montagem: sem o `useMemo`, cada render produziria
  // um instante novo, e com ele uma chave de consulta nova — a tela
  // recarregaria sozinha, para sempre.
  const { since, monthStart } = useMemo(
    () => ({ since: startOfToday(), monthStart: startOfMonth() }),
    [],
  );

  const monthParams = { from: monthStart, limit: ADMIN_MAX_PAGE_SIZE };
  const pendingParams = { status: ORDER_STATUSES.PENDING_CONTACT, limit: 1 };
  const recentParams = { limit: RECENT_COUNT };
  const productParams = { limit: ADMIN_MAX_PAGE_SIZE };

  const month = useQuery({
    queryKey: adminKeys.orderList(monthParams),
    queryFn: ({ signal }) => listOrders(monthParams, signal),
    staleTime: STALE_TIME_MS,
  });

  const pending = useQuery({
    queryKey: adminKeys.orderList(pendingParams),
    queryFn: ({ signal }) => listOrders(pendingParams, signal),
    staleTime: STALE_TIME_MS,
  });

  const recent = useQuery({
    queryKey: adminKeys.orderList(recentParams),
    queryFn: ({ signal }) => listOrders(recentParams, signal),
    staleTime: STALE_TIME_MS,
  });

  const products = useQuery({
    queryKey: adminKeys.productList(productParams),
    queryFn: ({ signal }) => listProducts(productParams, signal),
    staleTime: STALE_TIME_MS,
  });

  const monthOrders = month.data?.items ?? [];
  const catalog = products.data?.items ?? [];

  return {
    todayCount: countSince(monthOrders, since),
    pendingCount: pending.data?.totalItems ?? 0,
    monthRevenue: revenueOf(monthOrders, month.data?.hasMore ?? false),
    outOfStockCount: outOfStock(catalog).length,
    recentOrders: recent.data?.items ?? [],
    lowStock: lowStock(catalog),
    isLoading: month.isPending || pending.isPending || recent.isPending || products.isPending,
    isError: month.isError || pending.isError || recent.isError || products.isError,
  };
}
