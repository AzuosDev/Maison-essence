import { api, SESSION_SCOPES } from '@/lib/http';
import type { AdminOrderListParams, AdminProductListParams } from './admin.keys';
import type {
  AdminCategoryNode,
  AdminOrder,
  AdminOrderSummary,
  AdminPage,
  AdminProduct,
  CreateProductInput,
  OrderStatus,
  UpdateProductInput,
} from './admin.types';

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

/** Cria o produto. O endereco (`slug`) so pode ser escolhido aqui. */
export function createProduct(
  input: CreateProductInput,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  return api.post<AdminProduct>('/admin/products', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Salva a edicao.
 *
 * O array de variantes vai **inteiro**: a lista enviada passa a ser a lista
 * do produto, e o que sumiu dela e removido ou aposentado do lado de la. E
 * por isso que a tela manda o que ela mostra, e nunca um pedaco.
 */
export function updateProduct(
  id: string,
  input: UpdateProductInput,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  return api.patch<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Apaga o produto.
 *
 * Diferente do pedido, que so e cancelado: um produto cadastrado por engano
 * nao tem historico a preservar. O servidor recusa quando ha pedido
 * apontando para ele, e a tela mostra a frase de la.
 */
export function deleteProduct(id: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/admin/products/${encodeURIComponent(id)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/* ---- Categorias ---------------------------------------------------------- */

/**
 * A arvore inteira, em uma chamada.
 *
 * Sem paginacao e sem filtro: uma loja de perfumes tem dezenas de
 * categorias, nao milhares, e tanto o seletor do formulario quanto o filtro
 * da listagem precisam dela completa para desenhar pai e filho juntos.
 */
export function listAdminCategories(signal?: AbortSignal): Promise<AdminCategoryNode[]> {
  return api.get<AdminCategoryNode[]>('/admin/categories', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}
