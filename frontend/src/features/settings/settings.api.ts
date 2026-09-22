import { api } from '@/lib/http';
import type { PublicPage, PublicPageSummary, PublicSettings } from './settings.types';

/**
 * As duas chamadas que a moldura da loja faz.
 *
 * Publicas — `scope: null` — porque a barra de avisos e o rodape aparecem
 * para quem nunca entrou em conta nenhuma. Sem isso, um `401` aqui tentaria
 * renovar uma sessao que nao existe.
 *
 * As duas respostas vem com `Cache-Control` de cinco minutos e `ETag` do
 * backend, entao a revalidacao entre visitas custa um `304` sem corpo.
 */

export function fetchSettings(signal?: AbortSignal): Promise<PublicSettings> {
  return api.get<PublicSettings>('/settings', { scope: null, ...(signal ? { signal } : {}) });
}

export function fetchInstitutionalPages(signal?: AbortSignal): Promise<PublicPageSummary[]> {
  return api.get<PublicPageSummary[]>('/pages', { scope: null, ...(signal ? { signal } : {}) });
}

/**
 * Uma pagina institucional pelo endereco, com o texto.
 *
 * Quem chama hoje sao as abas da pagina do produto — "Trocas e devolucoes"
 * nao e um texto do produto, e sim a politica da loja, escrita uma vez e
 * mostrada em todo lugar onde faz falta. A pagina institucional inteira usa
 * a mesma funcao e a mesma chave quando chegar.
 */
export function fetchInstitutionalPage(slug: string, signal?: AbortSignal): Promise<PublicPage> {
  return api.get<PublicPage>(`/pages/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
