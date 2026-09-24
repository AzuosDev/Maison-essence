import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AlertIcon, ProductsTable, SearchIcon, TruckIcon } from '@/components/admin';
import {
  Button,
  ButtonLink,
  EmptyState,
  Input,
  Pagination,
  Select,
  useToast,
} from '@/components/ui';
import {
  canManageStore,
  canSeePrices,
  productFiltersToSearch,
  productListParams,
  readProductFilters,
  useAdminCategories,
  useAdminRole,
  useProducts,
  useSetProductStatus,
  useSetReadyToShip,
  withProductFilter,
  type AdminCategoryNode,
  type AdminProduct,
  type ProductFilters,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-ready-to-ship-page.module.css';

/**
 * A prateleira.
 *
 * ## Por que nao e um filtro da tela de produtos
 *
 * Porque nao e um recorte do catalogo: e um lugar fisico. A pronta entrega e
 * a estante da loja, o que a cliente leva na hora, e a secao que mais vende
 * no local — e a pergunta que se faz sobre ela nao e "quais produtos tem essa
 * marca?", e sim "o que esta aqui hoje bate com o que o site diz que esta?".
 *
 * Essa pergunta se responde com uma lista curta na mao, conferindo caixa por
 * caixa. Um filtro a mais numa listagem de duzentos produtos nao e isso.
 *
 * ## Tirar acontece aqui; por, no cadastro
 *
 * Tirar e o gesto da conferencia: acabou a caixa, sai da prateleira, e sai
 * dali mesmo, sem abrir o cadastro. Por e uma decisao sobre o produto — junto
 * de destaque, de categoria e de preco —, e mora no cadastro, onde ela e
 * tomada com o resto.
 *
 * ## O que a linha some quer dizer
 *
 * Que ela saiu da prateleira. A lista mostra so o que esta na pronta entrega,
 * entao manter a linha com o interruptor desligado seria a tela discordando
 * do proprio recorte. O caminho de volta e o "Desfazer" do aviso.
 *
 * ## O que o STAFF ve
 *
 * A lista, sem preco e sem editar — e sem tirar nada dela. Ele consulta a
 * prateleira para responder "tem para levar hoje?" no WhatsApp, que e
 * exatamente a pergunta que esta tela responde.
 */

/** O tempo que a digitacao precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

export default function AdminReadyToShipPage() {
  const role = useAdminRole();
  const { toast } = useToast();
  const [search, setSearch] = useSearchParams();

  const filters = readProductFilters(search);
  // `readyToShip` nao vem do endereco: ele **e** a tela. Um recorte que se
  // pode desligar faria desta pagina uma copia da de produtos.
  const params = { ...productListParams(filters), readyToShip: true };

  usePageMeta({ title: 'Pronta entrega — Painel', description: 'Acesso restrito.' });

  const canEdit = canManageStore(role);

  const { data, isPending, isFetching, isError, error } = useProducts(params);
  const { data: categories } = useAdminCategories();
  const setStatus = useSetProductStatus(params);
  const setReadyToShip = useSetReadyToShip(params);

  const apply = (patch: Partial<ProductFilters>): void => {
    setSearch(productFiltersToSearch(withProductFilter(filters, patch)), { replace: true });
  };

  const categoryNames = useMemo(() => namesOf(categories ?? []), [categories]);
  const categoryOptions = useMemo(() => optionsOf(categories ?? []), [categories]);

  const products = data?.items ?? [];
  const filtered = filters.q !== '' || filters.categoryId !== '';

  // Produto na prateleira e fora do ar e o estado que so esta tela enxerga:
  // a caixa esta ali, e a cliente nao consegue comprar.
  const hidden = products.filter((product) => !product.isActive);

  const fail = (product: AdminProduct) => (cause: unknown) => {
    toast({
      variant: 'danger',
      title: `${product.name} continua como estava`,
      description: errorMessage(cause),
    });
  };

  const setShelf = (product: AdminProduct, isReadyToShip: boolean): void => {
    setReadyToShip.mutate(
      { id: product.id, isReadyToShip },
      {
        onSuccess: () => {
          if (!isReadyToShip) {
            toast({
              title: `${product.name} saiu da prateleira`,
              description: 'O selo verde some do card, e a cliente deixa de ver "pronta entrega".',
              action: {
                label: 'Desfazer',
                onSelect: () => {
                  setShelf(product, true);
                },
              },
            });
          }
        },
        onError: fail(product),
      },
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.title}>Pronta entrega</h1>

          <p className={styles.count} aria-live="polite">
            {summary(data?.totalItems, isPending, filtered)}
          </p>
        </div>
      </header>

      <p className={styles.hint}>
        O que a cliente leva na hora. Estes produtos ganham o selo verde no card e aparecem na seção
        da home — poe-se um produto aqui pelo interruptor "Pronta entrega" do cadastro.
      </p>

      <div className={styles.filters}>
        <SearchField
          value={filters.q}
          onSearch={(q) => {
            apply({ q });
          }}
        />

        <Select
          label="Categoria"
          hideLabel
          block
          className={styles.category}
          placeholder="Todas as categorias"
          options={categoryOptions}
          value={filters.categoryId}
          onChange={(event) => {
            apply({ categoryId: event.target.value });
          }}
        />

        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch({}, { replace: true });
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {hidden.length === 0 ? null : (
        <p className={styles.warning}>
          <AlertIcon />
          {hidden.length === 1
            ? `${hidden[0]?.name ?? ''} esta na prateleira e fora do ar: a caixa esta aí, e a cliente não consegue comprar.`
            : `${String(hidden.length)} destes estão na prateleira e fora do ar: as caixas estão aí, e a cliente não consegue compra-las.`}
        </p>
      )}

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : (
        <>
          <div className={isFetching && !isPending ? styles.refreshing : undefined}>
            {!isPending && products.length === 0 ? (
              <EmptyState
                as="h2"
                title={filtered ? 'Nada na prateleira neste recorte' : 'A prateleira esta vazia'}
                description={
                  filtered
                    ? 'Mude a categoria ou o que esta na busca.'
                    : 'Nenhum produto esta marcado como pronta entrega. A marca fica no cadastro do produto, e e ela que poe o selo verde no card e enche a seção da home.'
                }
                actions={
                  filtered ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSearch({}, { replace: true });
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : canEdit ? (
                    <ButtonLink to={ROUTES.admin.products}>
                      <TruckIcon />
                      Ir para o catalogo
                    </ButtonLink>
                  ) : undefined
                }
              />
            ) : (
              <ProductsTable
                products={products}
                isLoading={isPending}
                categoryNames={categoryNames}
                showPrices={canSeePrices(role)}
                canEdit={canEdit}
                onToggleStatus={(product) => {
                  setStatus.mutate(
                    { id: product.id, isActive: !product.isActive },
                    { onError: fail(product) },
                  );
                }}
                onToggleReadyToShip={
                  canEdit
                    ? (product) => {
                        setShelf(product, !product.isReadyToShip);
                      }
                    : undefined
                }
              />
            )}
          </div>

          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(page) => {
              apply({ page });
            }}
            label="Páginas da pronta entrega"
          />
        </>
      )}
    </div>
  );
}

/* ---- A busca --------------------------------------------------------------- */

/** Mesmo campo das outras listas: responde a cada tecla, consulta na pausa. */
function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [typed, setTyped] = useState(value);
  const settled = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    setTyped(value);
  }, [value]);

  useEffect(() => {
    if (settled !== value) {
      onSearch(settled);
    }
    // `onSearch` e `value` fecham sobre os filtros atuais e mudam a cada
    // render. O que dispara a busca e o texto ter parado de mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  return (
    <Input
      label="Buscar na prateleira"
      hideLabel
      block
      type="search"
      inputMode="search"
      autoComplete="off"
      placeholder="Nome ou marca"
      prefix={<SearchIcon />}
      value={typed}
      onChange={(event) => {
        setTyped(event.target.value);
      }}
    />
  );
}

/* ---- As categorias, em duas formas ------------------------------------------- */

/** Nome por id, para a coluna da tabela. Pais e filhos no mesmo mapa. */
function namesOf(tree: readonly AdminCategoryNode[]): Map<string, string> {
  const names = new Map<string, string>();

  for (const parent of tree) {
    names.set(parent.id, parent.name);

    for (const child of parent.children) {
      names.set(child.id, child.name);
    }
  }

  return names;
}

/** As opcoes do filtro, com a subcategoria recuada pelo travessao. */
function optionsOf(tree: readonly AdminCategoryNode[]): { value: string; label: string }[] {
  return tree.flatMap((parent) => [
    { value: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ value: child.id, label: `— ${child.name}` })),
  ]);
}

/* ---- A linha de contagem ------------------------------------------------------ */

function summary(total: number | undefined, isPending: boolean, filtered: boolean): string {
  if (isPending || total === undefined) {
    return 'Carregando a prateleira';
  }

  const noun = total === 1 ? 'produto na prateleira' : 'produtos na prateleira';

  return filtered ? `${String(total)} ${noun}, neste recorte` : `${String(total)} ${noun}`;
}
