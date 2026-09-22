import { api, SESSION_SCOPES } from '@/lib/http';
import type { AdminOrderListParams, AdminProductListParams } from './admin.keys';
import type { AdminOrder, AdminOrderSummary, AdminPage, AdminProduct, OrderStatus } from './admin.types';

/**
 * As chamadas do painel.
 *
 * Todas no escopo `ADMIN`: o token do painel e outro, o refresh e outro, e um
 * `401` aqui renova a sessao da dona — nunca a do cliente que talvez esteja
 * logado na mesma aba.
 *
 * Os caminhos sao os do backend (`/admin/...`, em ingles), e nao os das rotas
 * da tela (`/admin/pedidos`). Sao vocabularios diferentes de proposito: um e
 * contrato, o outro e endereco que a dona le.
 */

/* ---- Pedidos ------------------------------------------------------------ */

export function listOrders(
  params: AdminOrderListParams,
  signal?: AbortSignal,
): Promise<AdminPage<AdminOrderSummary>> {
  return api.get<AdminPage<AdminOrderSummary>>('/admin/orders', {
    scope: SESSION_SCOPES.ADMIN,
    query: params,
    ...(signal ? { signal } : {}),
  });
}

export function fetchOrder(id: string, signal?: AbortSignal): Promise<AdminOrder> {
  return api.get<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Move o pedido de status.
 *
 * E a unica acao do painel que o cliente sente do outro lado: o mesmo pedido
 * aparece atualizado na conta dele e na confirmacao que ele guardou. Por isso
 * quem chama invalida a familia inteira de pedidos — a lista, a contagem do
 * Inicio e o detalhe falam do mesmo dado.
 */
export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  signal?: AbortSignal,
): Promise<AdminOrder> {
  return api.patch<AdminOrder>(
    `/admin/orders/${encodeURIComponent(id)}/status`,
    { status },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/** A anotacao interna do pedido. */
export function updateOrderNotes(
  id: string,
  notes: string,
  signal?: AbortSignal,
): Promise<AdminOrder> {
  return api.patch<AdminOrder>(
    `/admin/orders/${encodeURIComponent(id)}/notes`,
    { notes },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/* ---- Produtos ----------------------------------------------------------- */

export function listProducts(
  params: AdminProductListParams,
  signal?: AbortSignal,
): Promise<AdminPage<AdminProduct>> {
  return api.get<AdminPage<AdminProduct>>('/admin/products', {
    scope: SESSION_SCOPES.ADMIN,
    query: params,
    ...(signal ? { signal } : {}),
  });
}

export function fetchAdminProduct(id: string, signal?: AbortSignal): Promise<AdminProduct> {
  return api.get<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Publica ou despublica um produto.
 *
 * Rota propria (`PATCH /admin/products/:id/status`), e nao o `PATCH` inteiro:
 * e o que permite ao interruptor da tabela mandar um campo so, sem carregar
 * o produto inteiro para devolve-lo com uma flag diferente.
 */
export function updateProductStatus(
  id: string,
  isActive: boolean,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  return api.patch<AdminProduct>(
    `/admin/products/${encodeURIComponent(id)}/status`,
    { isActive },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}
