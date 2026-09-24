import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionalPages, fetchSettings } from './settings.api';
import { settingsKeys } from './settings.keys';
import type { PublicPageSummary, PublicSettings } from './settings.types';

/**
 * As configurações da loja, buscadas uma vez e distribuidas por contexto.
 *
 * Quem faz as chamadas e o layout da loja, no topo da árvore. Cabeçalho,
 * rodapé, barra de avisos e o botão do WhatsApp leem daqui — nenhum deles
 * chama a API por conta própria.
 *
 * O TanStack Query já deduplicaria as chamadas pela chave, então o contexto
 * não existe para evitar requisição repetida: existe para tornar a regra
 * visível. Com ele, um componente que tentasse buscar de novo teria que
 * importar a função, escrever a própria `useQuery` e ignorar o hook que esta
 * a mão — coisa que se vê na revisão. Sem ele, o segundo `useQuery` seria
 * indistinguível do primeiro.
 *
 * Os dados não mudam durante a visita, então o `staleTime` e longo: a dona
 * trocar o texto da barra de avisos aparece na próxima navegação completa, e
 * não há por que revalidar isso a cada troca de rota.
 */

/** Meia hora. A resposta já vem com cinco minutos de cache na borda. */
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
 * As configurações, ou `undefined` enquanto carregam.
 *
 * Não há tela de carregamento no lugar da loja: a moldura desenha com o que
 * tem. O cabeçalho aparece sem a barra de avisos por um instante, e o botão
 * do WhatsApp só aparece quando há número — que e exatamente o que deve
 * acontecer quando a loja ainda não configurou um.
 */
export function useStoreSettings(): StoreSettingsContextValue {
  const context = useContext(StoreSettingsContext);

  if (!context) {
    throw new Error('useStoreSettings precisa estar dentro de <StoreSettingsProvider>.');
  }

  return context;
}
