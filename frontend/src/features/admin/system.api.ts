import { api, SESSION_SCOPES } from '@/lib/http';
import type {
  AuditEntry,
  AuditListParams,
  CollectionCount,
  CreateUserInput,
  HealthStatus,
  PasswordResetResult,
  SeedResult,
  SystemUser,
  UpdateUserInput,
} from './system.types';
import type { AdminPage } from './admin.types';

/**
 * As chamadas da área de sistema.
 *
 * ## Os caminhos são `/users`, e não `/admin/users`
 *
 * O backend montou o controlador em `/users`, sem prefixo de painel, e o
 * frontend segue o contrato em vez de corrigi-lo: caminho inventado não
 * responde. A rota e protegida por `@Roles(...)` do mesmo jeito que as de
 * `/admin`, então a diferença e só de nome.
 *
 * ## O que ainda não existe
 *
 * Três chamadas daqui apontam para rotas que o backend **não publica**:
 * `listAudit`, `listCollections` e `runDemoSeed` — e `revokeSessions`, que e
 * a quarta. Os caminhos escolhidos são os naturais para cada uma, e as telas
 * que as usam tratam o `404` com uma mensagem que nomeia a rota que falta,
 * em vez de mostrar "algo deu errado".
 *
 * Elas ficam aqui, e não comentadas ou ausentes, por um motivo prático: no
 * dia em que o backend publicar qualquer uma delas, a tela correspondente
 * começa a funcionar sem uma linha de frontend mudar. Cada função diz, no
 * próprio comentário, o que falta do outro lado.
 */

/* ---- Usuários ----------------------------------------------------------- */

/**
 * Todos os usuários do painel.
 *
 * Sem paginação, e e o backend quem decide assim: a rota devolve a lista
 * inteira ordenada por nome. Faz sentido para o tamanho do problema — uma
 * loja com três a dez contas —, e e por isso que esta tela filtra e ordena
 * no cliente em vez de mandar parâmetros que ninguém lê.
 */
export function listUsers(signal?: AbortSignal): Promise<SystemUser[]> {
  return api.get<SystemUser[]>('/users', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Cria um usuário com a senha que o painel gerou.
 *
 * O registro nasce com `mustChangePassword`: quem criou digitou a senha e
 * portanto a conhece, então ela só serve para o primeiro login.
 */
export function createUser(input: CreateUserInput, signal?: AbortSignal): Promise<SystemUser> {
  return api.post<SystemUser>('/users', input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

export function updateUser(
  id: string,
  input: UpdateUserInput,
  signal?: AbortSignal,
): Promise<SystemUser> {
  return api.patch<SystemUser>(`/users/${encodeURIComponent(id)}`, input, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Ativa ou desativa.
 *
 * Desativar revoga as sessões no servidor, na mesma operação — e o que faz o
 * usuário cair na próxima ação dele, e não quando o token expirar sozinho.
 * E o critério de aceite desta tela, e ele e cumprido do outro lado.
 */
export function setUserStatus(
  id: string,
  isActive: boolean,
  signal?: AbortSignal,
): Promise<SystemUser> {
  return api.patch<SystemUser>(
    `/users/${encodeURIComponent(id)}/status`,
    { isActive },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * Gera uma senha temporária nova e derruba as sessões do alvo.
 *
 * A senha volta em texto **uma única vez**, nesta resposta. Quem chama
 * mostra e esquece: não entra em cache, não e gravada e não há rota que a
 * recupere depois.
 */
export function resetUserPassword(id: string, signal?: AbortSignal): Promise<PasswordResetResult> {
  return api.post<PasswordResetResult>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    {},
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * Encerra todas as sessões de um usuário sem mexer na senha dele.
 *
 * **A rota não existe no backend.** Não há `POST /users/:id/revoke-sessions`
 * publicado: o servidor revoga sessões como efeito de duas outras ações
 * (desativar e resetar a senha), e nenhuma delas e "só derrube quem esta
 * logado". Enquanto isso, esta chamada responde `404` e a tela diz o que
 * fazer no lugar.
 */
export function revokeSessions(id: string, signal?: AbortSignal): Promise<void> {
  return api.post<void>(
    `/users/${encodeURIComponent(id)}/revoke-sessions`,
    {},
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/* ---- Auditoria ---------------------------------------------------------- */

/**
 * A trilha de auditoria, filtrada e paginada.
 *
 * **A rota não existe no backend.** O módulo de auditoria tem serviço e
 * coleção — `audit_entries`, com dois anos de retenção — mas nenhum
 * controlador: tudo que se escreve lá hoje só sai por consulta direta ao
 * banco. O que falta e um `GET /audit` que receba `actorId`, `action`,
 * `from`, `to`, `page` e `limit` e devolva a página no mesmo formato das
 * outras listas do painel.
 */
export function listAudit(
  params: AuditListParams,
  signal?: AbortSignal,
): Promise<AdminPage<AuditEntry>> {
  return api.get<AdminPage<AuditEntry>>('/audit', {
    scope: SESSION_SCOPES.ADMIN,
    query: params,
    ...(signal ? { signal } : {}),
  });
}

/* ---- Saúde -------------------------------------------------------------- */

/**
 * O health check.
 *
 * `scope: null` porque a rota e publica — e propositalmente: um monitor
 * externo precisa alcança-lá sem credencial. E a única chamada desta tela
 * que funciona hoje.
 */
export function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health', {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Quantos documentos há em cada coleção.
 *
 * **A rota não existe no backend.** Falta um `GET /admin/system/collections`
 * restrito ao SUPER_ADMIN, devolvendo `[{ name, count }]` — um
 * `db.collection(name).estimatedDocumentCount()` por coleção registrada.
 */
export function listCollections(signal?: AbortSignal): Promise<CollectionCount[]> {
  return api.get<CollectionCount[]>('/admin/system/collections', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Roda o seed de demonstração.
 *
 * **A rota não existe no backend.** O seed existe como script de linha de
 * comando (`npm run seed:demo`, em `backend/src/seeds/`), e não como rota:
 * nenhum controlador injeta o `DemoSeedService`. Falta um
 * `POST /admin/system/seed` que recuse fora de desenvolvimento — o botão
 * desta tela já só aparece em `import.meta.env.DEV`, mas a garantia que vale
 * e a do servidor, não a do build.
 */
export function runDemoSeed(signal?: AbortSignal): Promise<SeedResult> {
  return api.post<SeedResult>(
    '/admin/system/seed',
    {},
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}
