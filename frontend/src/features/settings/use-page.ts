import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionalPage } from './settings.api';
import { settingsKeys } from './settings.keys';
import { useStoreSettings } from './settings-context';
import type { PublicPage } from './settings.types';

/**
 * Uma página institucional, buscada só quando ela existe.
 *
 * O `enabled` não e economia de requisição: e o que evita um 404. A dona
 * publica as páginas quando escreve cada uma, e `GET /pages` só lista as
 * publicadas — então a listagem que a moldura da loja já carregou e a
 * resposta para "esta página existe hoje?". Perguntar direto ao endereço
 * produziria um erro no console em toda visita a um produto, por uma página
 * que ninguém escreveu ainda.
 *
 * Meia hora de frescor, igual ao resto das configurações: e texto que muda
 * algumas vezes por ano.
 */
const STALE_TIME_MS = 30 * 60 * 1000;

export interface InstitutionalPageQuery {
  page: PublicPage | undefined;
  /** A página esta publicada — a aba tem por que existir. */
  exists: boolean;
  /**
   * A listagem ainda não respondeu: ninguém sabe se a página existe.
   *
   * Uma aba ausente não custa nada e some sozinha quando a listagem chega,
   * mas uma página aberta pelo endereço precisa deste campo para não dizer
   * "esta página não existe" no primeiro quadro de toda visita.
   */
  isUnknown: boolean;
  isLoading: boolean;
  /** A página existe e a busca dela falhou — rede, 500, timeout. */
  isError: boolean;
  /** Tenta de novo. Para o botão da tela de falha. */
  retry: () => void;
}

export function useInstitutionalPage(slug: string): InstitutionalPageQuery {
  const { pages, arePagesLoading } = useStoreSettings();
  const exists = pages.some((page) => page.slug === slug);

  const query = useQuery<PublicPage>({
    queryKey: settingsKeys.page(slug),
    queryFn: ({ signal }) => fetchInstitutionalPage(slug, signal),
    enabled: exists,
    staleTime: STALE_TIME_MS,
  });

  return {
    page: query.data,
    exists,
    isUnknown: arePagesLoading,
    isLoading: exists && query.isPending,
    isError: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
