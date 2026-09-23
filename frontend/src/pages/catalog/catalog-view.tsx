import { useState, type ReactNode } from 'react';
import { ProductGrid } from '@/components/store';
import {
  Button,
  Container,
  Drawer,
  Pagination,
  Select,
  type BreadcrumbItem,
} from '@/components/ui';
import {
  PAGE_SIZE,
  SORT_KEYS,
  SORT_LABELS,
  useCatalogFacets,
  useProductList,
  type CatalogContext,
  type SortKey,
} from '@/features/catalog';
import { useMediaQuery } from '@/lib/use-media-query';
import { CatalogEmpty } from './catalog-empty';
import { CatalogHeader } from './catalog-header';
import { FilterPanel } from './filter-panel';
import { useCatalogFilters } from './use-catalog-filters';
import styles from './catalog-view.module.css';

/**
 * A listagem de produtos.
 *
 * Uma tela so para os quatro enderecos que mostram uma lista filtravel:
 * `/produtos`, `/pronta-entrega`, `/categorias/:slug` e `/busca`. O que muda
 * entre eles e o cabecalho e o contexto — a categoria fixa, a bandeira fixa,
 * o termo buscado —, e nada disso justifica quatro telas para manter em dia.
 * Cada rota tem um modulo de tres linhas que monta esta com as propriedades
 * dela.
 *
 * ## A diferenca entre celular e desktop nao e so visual
 *
 * No desktop a paginacao e numerada: a pagina pedida e a unica em tela. No
 * celular o cliente aperta "carregar mais" e as paginas se empilham. Como
 * isso muda **quantas** consultas a tela faz, e nao so como as desenha, a
 * decisao precisa chegar ao JavaScript — por isso o `useMediaQuery` aqui, em
 * vez de um `@media` na folha de estilo.
 *
 * O mesmo vale para a barra de filtros: no desktop ela e uma coluna fixa, no
 * celular uma gaveta. Montar as duas e esconder uma com CSS colocaria dois
 * formularios iguais no documento ao mesmo tempo, e o leitor de tela
 * anunciaria cada filtro duas vezes.
 *
 * ## A posicao de rolagem
 *
 * Quem a devolve e o `ScrollRestoration` do layout da loja. O que esta tela
 * faz e mais importante: garantir que haja **onde** pousar. As paginas ficam
 * no cache do TanStack Query por um minuto, entao voltar do produto encontra
 * a lista inteira — as tres paginas que o cliente tinha carregado — desenhada
 * de imediato, na mesma altura de antes. Uma tela que remontasse do zero
 * teria altura de esqueleto no instante da restauracao, e o navegador
 * pousaria no lugar errado.
 */

export interface CatalogViewProps {
  title: string;
  description?: string | undefined;
  breadcrumb: readonly BreadcrumbItem[];
  /** O que a rota fixou: a categoria, a bandeira de pronta entrega. */
  context?: CatalogContext;
  /** O titulo vem de outra consulta e ainda nao chegou. */
  isTitleLoading?: boolean;
  /** As pilulas de subcategoria, quando a rota tem uma categoria. */
  chips?: ReactNode;
  /** O termo buscado, realcado nos nomes. So `/busca` passa. */
  highlight?: string;
  /** O texto do vazio, que muda conforme a rota. */
  emptyTitle?: string;
  emptyDescription?: string;
}

/** A partir de onde a barra de filtros vira coluna e a paginacao vira numero. */
const DESKTOP = '(min-width: 64rem)';

/** Sem contexto: a rota nao fixou categoria nem bandeira nenhuma. */
const NO_CONTEXT: CatalogContext = {};

export function CatalogView({
  title,
  description,
  breadcrumb,
  context = NO_CONTEXT,
  isTitleLoading = false,
  chips,
  highlight = '',
  emptyTitle = 'Nenhum produto encontrado',
  emptyDescription = 'Tente afrouxar os filtros ou procurar por outro termo.',
}: CatalogViewProps) {
  const isDesktop = useMediaQuery(DESKTOP);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { filters, activeCount, update, goToPage, clear } = useCatalogFilters(context);
  const facets = useCatalogFacets(filters.q, context);
  const list = useProductList(filters, context, !isDesktop);

  const isEmpty = !list.isLoading && list.products.length === 0;

  const panel = (
    <FilterPanel
      filters={filters}
      context={context}
      facets={facets}
      activeCount={activeCount}
      onChange={update}
      onClear={() => {
        clear();
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <Container className={styles.page}>
      <CatalogHeader
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        totalItems={list.totalItems}
        isLoading={list.isLoading}
        isTitleLoading={isTitleLoading}
      />

      {chips}

      <div className={styles.toolbar}>
        {isDesktop ? null : (
          // Tamanho normal, e nao `small`: e um botao que so existe no
          // celular, onde 36px de altura ficam abaixo do alvo de toque — e
          // ele divide a linha com o seletor de ordem, que tem 48. Os dois
          // com a mesma altura fecham a barra numa faixa so.
          <Button
            variant="secondary"
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            Filtros{activeCount > 0 ? ` (${String(activeCount)})` : ''}
          </Button>
        )}

        <Select
          label="Ordenar por"
          hideLabel
          block={false}
          className={styles.sort}
          // Com o filtro de desconto ligado, a ordem e imposta pela varredura
          // que o substitui (ver `apiParamsFrom`). O seletor mostra a ordem
          // que esta valendo de verdade, em vez de anunciar uma que a lista
          // nao esta seguindo.
          value={filters.onSale ? 'desconto' : (filters.sort ?? defaultSort(filters.q))}
          disabled={filters.onSale}
          options={SORT_KEYS.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
          onChange={(event) => {
            update({ sort: event.target.value as SortKey });
          }}
        />
      </div>

      <div className={styles.body}>
        {isDesktop ? (
          <aside className={styles.sidebar} aria-label="Filtros">
            {panel}
          </aside>
        ) : null}

        <div className={styles.results}>
          {isEmpty ? (
            <CatalogEmpty
              title={emptyTitle}
              description={emptyDescription}
              onClear={activeCount > 0 ? clear : undefined}
            />
          ) : (
            <>
              <ProductGrid
                products={list.products}
                isLoading={list.isLoading}
                appending={list.isFetchingMore}
                highlight={highlight}
                skeletonCount={PAGE_SIZE / 2}
              />

              {list.truncated ? (
                <p className={styles.note}>
                  Mostrando as primeiras {list.totalItems} promocoes. Use os filtros para estreitar
                  a lista.
                </p>
              ) : null}

              {isDesktop ? (
                <Pagination
                  page={list.page}
                  totalPages={list.totalPages}
                  onPageChange={goToPage}
                  className={styles.pagination}
                />
              ) : (
                list.hasMore && (
                  <div className={styles.more}>
                    <Button
                      variant="secondary"
                      block
                      disabled={list.isFetchingMore}
                      onClick={() => {
                        goToPage(list.page + 1);
                      }}
                    >
                      {list.isFetchingMore ? 'Carregando...' : 'Carregar mais'}
                    </Button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {isDesktop ? null : (
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
          }}
          side="left"
          title="Filtros"
          footer={
            <Button
              block
              onClick={() => {
                setDrawerOpen(false);
              }}
            >
              Ver {list.totalItems} produtos
            </Button>
          }
        >
          {panel}
        </Drawer>
      )}
    </Container>
  );
}

/**
 * A ordem que o backend aplica quando ninguem pediu nenhuma.
 *
 * Repetida aqui so para o seletor mostrar a opcao certa antes de o cliente
 * escolher — a decisao continua sendo do servidor (`effectiveSort`), e a URL
 * continua sem o parametro ate alguem mexer no campo.
 */
function defaultSort(q: string): SortKey {
  return q === '' ? 'novidades' : 'relevancia';
}
