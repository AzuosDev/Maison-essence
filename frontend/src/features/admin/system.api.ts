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
 * As chamadas da area de sistema.
 *
 * ## Os caminhos sao `/users`, e nao `/admin/users`
 *
 * O backend montou o controlador em `/users`, sem prefixo de painel, e o
 * frontend segue o contrato em vez de corrigi-lo: caminho inventado nao
 * responde. A rota e protegida por `@Roles(...)` do mesmo jeito que as de
 * `/admin`, entao a diferenca e so de nome.
 *
 * ## O que ainda nao existe
 *
 * Tres chamadas daqui apontam para rotas que o backend **nao publica**:
 * `listAudit`, `listCollections` e `runDemoSeed` — e `revokeSessions`, que e
 * a quarta. Os caminhos escolhidos sao os naturais para cada uma, e as telas
 * que as usam tratam o `404` com uma mensagem que nomeia a rota que falta,
 * em vez de mostrar "algo deu errado".
 *
 * Elas ficam aqui, e nao comentadas ou ausentes, por um motivo pratico: no
 * dia em que o backend publicar qualquer uma delas, a tela correspondente
 * comeca a funcionar sem uma linha de frontend mudar. Cada funcao diz, no
 * proprio comentario, o que falta do outro lado.
 */

/* ---- Usuarios ----------------------------------------------------------- */

/**
 * Todos os usuarios do painel.
 *
 * Sem paginacao, e e o backend quem decide assim: a rota devolve a lista
 * inteira ordenada por nome. Faz sentido para o tamanho do problema — uma
 * loja com tres a dez contas —, e e por isso que esta tela filtra e ordena
 * no cliente em vez de mandar parametros que ninguem le.
 */
export function listUsers(signal?: AbortSignal): Promise<SystemUser[]> {
  return api.get<SystemUser[]>('/users', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Cria um usuario com a senha que o painel gerou.
 *
 * O registro nasce com `mustChangePassword`: quem criou digitou a senha e
 * portanto a conhece, entao ela so serve para o primeiro login.
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
 * Desativar revoga as sessoes no servidor, na mesma operacao — e o que faz o
 * usuario cair na proxima acao dele, e nao quando o token expirar sozinho.
 * E o criterio de aceite desta tela, e ele e cumprido do outro lado.
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
 * Gera uma senha temporaria nova e derruba as sessoes do alvo.
 *
 * A senha volta em texto **uma unica vez**, nesta resposta. Quem chama
 * mostra e esquece: nao entra em cache, nao e gravada e nao ha rota que a
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
 * Encerra todas as sessoes de um usuario sem mexer na senha dele.
 *
 * **A rota nao existe no backend.** Nao ha `POST /users/:id/revoke-sessions`
 * publicado: o servidor revoga sessoes como efeito de duas outras acoes
 * (desativar e resetar a senha), e nenhuma delas e "so derrube quem esta
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
 * **A rota nao existe no backend.** O modulo de auditoria tem servico e
 * colecao — `audit_entries`, com dois anos de retencao — mas nenhum
 * controlador: tudo que se escreve la hoje so sai por consulta direta ao
 * banco. O que falta e um `GET /audit` que receba `actorId`, `action`,
 * `from`, `to`, `page` e `limit` e devolva a pagina no mesmo formato das
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

/* ---- Saude -------------------------------------------------------------- */

/**
 * O health check.
 *
 * `scope: null` porque a rota e publica — e propositalmente: um monitor
 * externo precisa alcanca-la sem credencial. E a unica chamada desta tela
 * que funciona hoje.
 */
export function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health', {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Quantos documentos ha em cada colecao.
 *
 * **A rota nao existe no backend.** Falta um `GET /admin/system/collections`
 * restrito ao SUPER_ADMIN, devolvendo `[{ name, count }]` — um
 * `db.collection(name).estimatedDocumentCount()` por colecao registrada.
 */
export function listCollections(signal?: AbortSignal): Promise<CollectionCount[]> {
  return api.get<CollectionCount[]>('/admin/system/collections', {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Roda o seed de demonstracao.
 *
 * **A rota nao existe no backend.** O seed existe como script de linha de
 * comando (`npm run seed:demo`, em `backend/src/seeds/`), e nao como rota:
 * nenhum controlador injeta o `DemoSeedService`. Falta um
 * `POST /admin/system/seed` que recuse fora de desenvolvimento — o botao
 * desta tela ja so aparece em `import.meta.env.DEV`, mas a garantia que vale
 * e a do servidor, nao a do build.
 */
export function runDemoSeed(signal?: AbortSignal): Promise<SeedResult> {
  return api.post<SeedResult>(
    '/admin/system/seed',
    {},
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}
