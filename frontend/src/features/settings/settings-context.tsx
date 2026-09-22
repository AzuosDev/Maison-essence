import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionalPages, fetchSettings } from './settings.api';
import { settingsKeys } from './settings.keys';
import type { PublicPageSummary, PublicSettings } from './settings.types';

/**
 * As configuracoes da loja, buscadas uma vez e distribuidas por contexto.
 *
 * Quem faz as chamadas e o layout da loja, no topo da arvore. Cabecalho,
 * rodape, barra de avisos e o botao do WhatsApp leem daqui — nenhum deles
 * chama a API por conta propria.
 *
 * O TanStack Query ja deduplicaria as chamadas pela chave, entao o contexto
 * nao existe para evitar requisicao repetida: existe para tornar a regra
 * visivel. Com ele, um componente que tentasse buscar de novo teria que
 * importar a funcao, escrever a propria `useQuery` e ignorar o hook que esta
 * a mao — coisa que se ve na revisao. Sem ele, o segundo `useQuery` seria
 * indistinguivel do primeiro.
 *
 * Os dados nao mudam durante a visita, entao o `staleTime` e longo: a dona
 * trocar o texto da barra de avisos aparece na proxima navegacao completa, e
 * nao ha por que revalidar isso a cada troca de rota.
 */

/** Meia hora. A resposta ja vem com cinco minutos de cache na borda. */
const STALE_TIME_MS = 30 * 60 * 1000;

interface StoreSettingsContextValue {
  settings: PublicSettings | undefined;
  pages: PublicPageSummary[];
  isLoading: boolean;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | null>(null);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const settings = useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: ({ signal }) => fetchSettings(signal),
    staleTime: STALE_TIME_MS,
  });

  const pages = useQuery({
    queryKey: settingsKeys.pages(),
    queryFn: ({ signal }) => fetchInstitutionalPages(signal),
    staleTime: STALE_TIME_MS,
  });

  const value = useMemo(
    () => ({
      settings: settings.data,
      pages: pages.data ?? [],
      isLoading: settings.isLoading,
    }),
    [settings.data, settings.isLoading, pages.data],
  );

  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

/**
 * As configuracoes, ou `undefined` enquanto carregam.
 *
 * Nao ha tela de carregamento no lugar da loja: a moldura desenha com o que
 * tem. O cabecalho aparece sem a barra de avisos por um instante, e o botao
 * do WhatsApp so aparece quando ha numero — que e exatamente o que deve
 * acontecer quando a loja ainda nao configurou um.
 */
export function useStoreSettings(): StoreSettingsContextValue {
  const context = useContext(StoreSettingsContext);

  if (!context) {
    throw new Error('useStoreSettings precisa estar dentro de <StoreSettingsProvider>.');
  }

  return context;
}
