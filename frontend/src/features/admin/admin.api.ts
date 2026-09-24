import { api, SESSION_SCOPES } from '@/lib/http';
import type { AdminOrderListParams, AdminProductListParams } from './admin.keys';
import type {
  AdminCategory,
  AdminCategoryNode,
  AdminDeliveryCity,
  AdminOrder,
  AdminOrderSummary,
  AdminPage,
  AdminPaymentSettings,
  AdminProduct,
  AdminStoreSettings,
  CreateCategoryInput,
  CreateDeliveryCityInput,
  CreateProductInput,
  OrderStatus,
  UpdateCategoryInput,
  UpdateDeliveryCityInput,
  UpdatePaymentSettingsInput,
  UpdateProductInput,
  UpdateStoreSettingsInput,
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

export function createCategory(
  input: CreateCategoryInput,
  signal?: AbortSignal,
): Promise<AdminCategory> {
  return api.post<AdminCategory>('/admin/categories', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Edita a categoria. Campo omitido fica como esta.
 *
 * `parentId: null` promove a subcategoria a categoria principal — e por isso
 * o tipo aceita `null` de verdade, e nao so a ausencia: sao duas intencoes
 * diferentes, e confundi-las faria "tirar de dentro de Masculino" virar "nao
 * mexer no pai".
 */
export function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  signal?: AbortSignal,
): Promise<AdminCategory> {
  return api.patch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Regrava a ordem do menu.
 *
 * A lista vai inteira e em ordem de menu — cada pai seguido dos filhos dele —,
 * e nao so o item que se moveu: o servidor grava `order = indice` para cada
 * id citado, e a posicao de um so faz sentido em relacao a dos outros.
 *
 * A resposta e a arvore ja reordenada, que a tela adota no lugar do retrato
 * otimista.
 */
export function reorderCategories(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<AdminCategoryNode[]> {
  return api.patch<AdminCategoryNode[]>(
    '/admin/categories/reorder',
    { ids },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * Exclui a categoria, se ela estiver vazia.
 *
 * O servidor recusa com 409 quando ha subcategoria ou produto ativo, e manda
 * as contagens em `details` — e com elas que a tela oferece desativar, que
 * costuma ser o que a dona queria: some do menu da loja sem que nenhum
 * produto saia do lugar.
 */
export function deleteCategory(id: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/admin/categories/${encodeURIComponent(id)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/* ---- Entrega ------------------------------------------------------------- */

/**
 * As cidades atendidas, todas de uma vez.
 *
 * Sem paginacao: uma loja atende dez ou vinte cidades, e a tela precisa da
 * lista inteira para que a dona compare as taxas entre elas — que e a razao
 * de a tela existir.
 */
export function listDeliveryCities(signal?: AbortSignal): Promise<AdminDeliveryCity[]> {
  return api.get<AdminDeliveryCity[]>('/admin/delivery-cities', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

export function createDeliveryCity(
  input: CreateDeliveryCityInput,
  signal?: AbortSignal,
): Promise<AdminDeliveryCity> {
  return api.post<AdminDeliveryCity>('/admin/delivery-cities', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

export function updateDeliveryCity(
  id: string,
  input: UpdateDeliveryCityInput,
  signal?: AbortSignal,
): Promise<AdminDeliveryCity> {
  return api.patch<AdminDeliveryCity>(`/admin/delivery-cities/${encodeURIComponent(id)}`, input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/** Regrava a ordem da lista. A do checkout e esta. */
export function reorderDeliveryCities(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<AdminDeliveryCity[]> {
  return api.patch<AdminDeliveryCity[]>(
    '/admin/delivery-cities/reorder',
    { ids },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * Exclui a cidade.
 *
 * Sem checagem, ao contrario da exclusao de categoria: o pedido guarda nome,
 * estado, prazo e taxa em copia propria, e continua legivel depois que a
 * cidade some. O que se perde e poder voltar a atender ali sem recadastrar —
 * e por isso a tela oferece desativar.
 */
export function deleteDeliveryCity(id: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/admin/delivery-cities/${encodeURIComponent(id)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/* ---- Pagamento ----------------------------------------------------------- */

/**
 * Poe ou tira o produto da prateleira de pronta entrega.
 *
 * Usa o `PATCH` do produto com um campo so — o DTO aceita parcial —, e nao
 * uma rota propria como a de status: o interruptor de publicar existe em duas
 * telas e mereceu o atalho; este existe em uma, e uma rota a mais para ele
 * seria superficie de API sem quem a use.
 */
export function setProductReadyToShip(
  id: string,
  isReadyToShip: boolean,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  return api.patch<AdminProduct>(
    `/admin/products/${encodeURIComponent(id)}`,
    { isReadyToShip },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * As regras de pagamento, com a chave PIX inteira.
 *
 * `MANAGES_STORE` inclusive na leitura: o backend recusa o STAFF antes de
 * responder, e a tela nao chega a pedir. O nome carrega o `admin` porque a
 * loja tem a sua propria `fetchPaymentSettings`, que devolve outra coisa —
 * as formas aceitas, sem a chave.
 */
export function fetchAdminPaymentSettings(signal?: AbortSignal): Promise<AdminPaymentSettings> {
  return api.get<AdminPaymentSettings>('/admin/payment-settings', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Grava as regras.
 *
 * Documento unico: nao ha `:id`. A resposta vem com tudo ja normalizado pelo
 * servidor — a chave de telefone volta como `+5588...` — e e ela que entra no
 * cache, e nao o que foi enviado.
 */
export function updatePaymentSettings(
  input: UpdatePaymentSettingsInput,
  signal?: AbortSignal,
): Promise<AdminPaymentSettings> {
  return api.patch<AdminPaymentSettings>('/admin/payment-settings', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/* ---- Configuracoes da loja ------------------------------------------------ */

/**
 * As configuracoes inteiras, inclusive o que nao esta no ar.
 *
 * `MANAGES_STORE` inclusive na leitura. O nome carrega o `admin` porque a
 * loja tem a sua propria `fetchSettings`, que devolve o subconjunto publico —
 * sem banner agendado, sem pagina despublicada.
 */
export function fetchAdminSettings(signal?: AbortSignal): Promise<AdminStoreSettings> {
  return api.get<AdminStoreSettings>('/admin/settings', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Grava as configuracoes.
 *
 * Documento unico, sem `:id`. A resposta vem normalizada pelo servidor — o
 * WhatsApp so com digitos, a sigla do estado em maiuscula, o e-mail em
 * minuscula — e e ela que entra no cache, e nao o que foi enviado.
 */
export function updateSettings(
  input: UpdateStoreSettingsInput,
  signal?: AbortSignal,
): Promise<AdminStoreSettings> {
  return api.patch<AdminStoreSettings>('/admin/settings', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}
