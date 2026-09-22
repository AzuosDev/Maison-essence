import { api } from '@/lib/http';
import type { PublicPageSummary, PublicSettings } from './settings.types';

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
