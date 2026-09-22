import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionalPage } from './settings.api';
import { settingsKeys } from './settings.keys';
import { useStoreSettings } from './settings-context';
import type { PublicPage } from './settings.types';

/**
 * Uma pagina institucional, buscada so quando ela existe.
 *
 * O `enabled` nao e economia de requisicao: e o que evita um 404. A dona
 * publica as paginas quando escreve cada uma, e `GET /pages` so lista as
 * publicadas — entao a listagem que a moldura da loja ja carregou e a
 * resposta para "esta pagina existe hoje?". Perguntar direto ao endereco
 * produziria um erro no console em toda visita a um produto, por uma pagina
 * que ninguem escreveu ainda.
 *
 * Meia hora de frescor, igual ao resto das configuracoes: e texto que muda
 * algumas vezes por ano.
 */
const STALE_TIME_MS = 30 * 60 * 1000;

export interface InstitutionalPageQuery {
  page: PublicPage | undefined;
  /** A pagina esta publicada — a aba tem por que existir. */
  exists: boolean;
  isLoading: boolean;
}

export function useInstitutionalPage(slug: string): InstitutionalPageQuery {
  const { pages } = useStoreSettings();
  const exists = pages.some((page) => page.slug === slug);

  const query = useQuery<PublicPage>({
    queryKey: settingsKeys.page(slug),
    queryFn: ({ signal }) => fetchInstitutionalPage(slug, signal),
    enabled: exists,
    staleTime: STALE_TIME_MS,
  });

  return { page: query.data, exists, isLoading: exists && query.isPending };
}
