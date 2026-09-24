import { api } from '@/lib/http';
import type { PublicPage, PublicPageSummary, PublicSettings } from './settings.types';

/**
 * As duas chamadas que a moldura da loja faz.
 *
 * Públicas — `scope: null` — porque a barra de avisos e o rodapé aparecem
 * para quem nunca entrou em conta nenhuma. Sem isso, um `401` aqui tentaria
 * renovar uma sessão que não existe.
 *
 * As duas respostas vem com `Cache-Control` de cinco minutos e `ETag` do
 * backend, então a revalidação entre visitas custa um `304` sem corpo.
 */

export function fetchSettings(signal?: AbortSignal): Promise<PublicSettings> {
  return api.get<PublicSettings>('/settings', { scope: null, ...(signal ? { signal } : {}) });
}

export function fetchInstitutionalPages(signal?: AbortSignal): Promise<PublicPageSummary[]> {
  return api.get<PublicPageSummary[]>('/pages', { scope: null, ...(signal ? { signal } : {}) });
}

/**
 * Uma página institucional pelo endereço, com o texto.
 *
 * Quem chama hoje são as abas da página do produto — "Trocas e devoluções"
 * não e um texto do produto, e sim a política da loja, escrita uma vez e
 * mostrada em todo lugar onde faz falta. A página institucional inteira usa
 * a mesma função e a mesma chave quando chegar.
 */
export function fetchInstitutionalPage(slug: string, signal?: AbortSignal): Promise<PublicPage> {
  return api.get<PublicPage>(`/pages/${encodeURIComponent(slug)}`, {
    scope: null,
    ...(signal ? { signal } : {}),
  });
}
