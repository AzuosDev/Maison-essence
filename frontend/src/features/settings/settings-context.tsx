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
 * ## Por que um minuto, e por que a volta para a aba revalida
 *
 * O `staleTime` era de meia hora, com o argumento de que nada disto muda
 * durante uma visita. Muda, sim, para uma pessoa: a dona, que edita no painel
 * — quase sempre numa aba — e vai conferir na loja, noutra. A aba da loja tem
 * o seu próprio cache do TanStack Query: o `invalidateQueries` que o painel
 * dispara ao salvar não atravessa para ela. Com meia hora de `staleTime` e
 * `refetchOnWindowFocus` desligado, aquela aba ficava congelada até um
 * recarregamento completo, e trocar um banner de vaga parecia não ter sido
 * gravado.
 *
 * Um minuto, e revalidando ao voltar para a aba, e o que torna "salvei ali,
 * olho aqui" previsível. Não custa resposta: a rota devolve `ETag`, então a
 * revalidação que não encontra novidade e um `304` sem corpo.
 */

/** Um minuto, como o resto do catálogo. */
const STALE_TIME_MS = 60_000;

interface StoreSettingsContextValue {
  settings: PublicSettings | undefined;
  pages: PublicPageSummary[];
  isLoading: boolean;
  /**
   * A listagem de páginas ainda não respondeu.
   *
   * Separado de `isLoading` porque responde outra pergunta. A moldura da loja
   * desenha com o que tem e não espera por nada; quem precisa deste campo e
   * quem abre uma página institucional pelo endereço: lista vazia significa
   * "nenhuma publicada" depois da resposta e "ainda não sei" antes dela, e
   * tratar as duas igual faria a página piscar "não existe" antes de abrir.
   */
  arePagesLoading: boolean;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | null>(null);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const settings = useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: ({ signal }) => fetchSettings(signal),
    staleTime: STALE_TIME_MS,
    // Contra o padrão da aplicação, e pelo motivo escrito acima: esta e a
    // resposta que a dona edita noutra aba e vem conferir nesta.
    refetchOnWindowFocus: true,
  });

  const pages = useQuery({
    queryKey: settingsKeys.pages(),
    queryFn: ({ signal }) => fetchInstitutionalPages(signal),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const value = useMemo(
    () => ({
      settings: settings.data,
      pages: pages.data ?? [],
      isLoading: settings.isLoading,
      arePagesLoading: pages.isLoading,
    }),
    [settings.data, settings.isLoading, pages.data, pages.isLoading],
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
