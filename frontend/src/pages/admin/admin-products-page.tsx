import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog, PlusIcon, ProductsTable, SearchIcon } from '@/components/admin';
import {
  Button,
  ButtonLink,
  Chip,
  EmptyState,
  Input,
  Pagination,
  Select,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/app/routes';
import {
  activeProductFilterCount,
  canManageStore,
  canSeePrices,
  productFiltersToSearch,
  productListParams,
  readProductFilters,
  useAdminCategories,
  useAdminRole,
  useDeleteProduct,
  useProducts,
  useSetProductStatus,
  withProductFilter,
  type AdminCategoryNode,
  type AdminProduct,
  type ProductFilters,
  type ProductStatusFilter,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-products-page.module.css';

/**
 * O catalogo.
 *
 * ## A cena de uso
 *
 * Diferente da tela de pedidos, esta nao e aberta com uma pergunta pronta.
 * Ela e aberta para **conferir**: o que acabou, o que esta fora do ar, o que
 * falta cadastrar da remessa que chegou. Por isso o primeiro controle depois
 * da busca e o status — "me mostre o que nao esta no ar" — e a categoria vem
 * logo em seguida, que e como a dona pensa o estoque.
 *
 * ## O recorte mora no endereco
 *
 * Mesma regra da tela de pedidos, e pelo mesmo motivo pratico: o card "Sem
 * estoque" da abertura do painel aponta para ca, e a dona manda o link de um
 * recorte para quem ajuda a conferir.
 *
 * ## O que o STAFF ve
 *
 * A lista, sem preco e sem editar. Ele consulta o catalogo para responder no
 * WhatsApp — "tem o de 100 ml?" — e essa pergunta se responde com nome,
 * variante e estoque. O interruptor e o menu de acoes nao aparecem para ele,
 * e o backend recusa de todo jeito.
 */

/** O tempo que a digitacao precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

const STATUS_CHIPS: { value: ProductStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'No ar' },
  { value: 'inactive', label: 'Fora do ar' },
];

export default function AdminProductsPage() {
  const role = useAdminRole();
  const { toast } = useToast();
  const [search, setSearch] = useSearchParams();
  const filters = readProductFilters(search);
  const params = productListParams(filters);

  usePageMeta({ title: 'Produtos — Painel', description: 'Acesso restrito.' });

  const canEdit = canManageStore(role);

  const { data, isPending, isFetching, isError, error } = useProducts(params);
  const { data: categories } = useAdminCategories();
  const setStatus = useSetProductStatus(params);
  const remove = useDeleteProduct();

  const [deleting, setDeleting] = useState<AdminProduct | null>(null);

  const apply = (patch: Partial<ProductFilters>): void => {
    setSearch(productFiltersToSearch(withProductFilter(filters, patch)), { replace: true });
  };

  const clearFilters = (): void => {
    setSearch({}, { replace: true });
  };

  const categoryNames = useMemo(() => namesOf(categories ?? []), [categories]);
  const categoryOptions = useMemo(() => optionsOf(categories ?? []), [categories]);

  const products = data?.items ?? [];
  const activeCount = activeProductFilterCount(filters);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.title}>Produtos</h1>

          <p className={styles.count} aria-live="polite">
            {summary(data?.totalItems, isPending, activeCount > 0)}
          </p>
        </div>

        {canEdit ? (
          <ButtonLink to={ROUTES.admin.newProduct} className={styles.add}>
            <PlusIcon />
            Adicionar produto
          </ButtonLink>
        ) : null}
      </header>

      <div className={styles.filters}>
        <SearchField
          value={filters.q}
          onSearch={(q) => {
            apply({ q });
          }}
        />

        <fieldset className={styles.statuses}>
          <legend className="visually-hidden">Filtrar por situação</legend>

          {STATUS_CHIPS.map((chip) => (
            <Chip
              key={chip.value}
              active={filters.status === chip.value}
              onClick={() => {
                apply({ status: chip.value });
              }}
            >
              {chip.label}
            </Chip>
          ))}
        </fieldset>

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

        {activeCount > 0 ? (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

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
                title={activeCount > 0 ? 'Nenhum produto neste recorte' : 'O catalogo esta vazio'}
                description={
                  activeCount > 0
                    ? 'Mude a situação, a categoria ou o que esta na busca.'
                    : 'Cadastre o primeiro produto e ele aparece na vitrine assim que for publicado.'
                }
                actions={
                  activeCount > 0 ? (
                    <Button type="button" variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : canEdit ? (
                    <ButtonLink to={ROUTES.admin.newProduct}>Adicionar produto</ButtonLink>
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
                    {
                      onError: (cause) => {
                        toast({
                          variant: 'danger',
                          title: `${product.name} continua como estava`,
                          description: errorMessage(cause),
                        });
                      },
                    },
                  );
                }}
                onDelete={setDeleting}
              />
            )}
          </div>

          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(page) => {
              apply({ page });
            }}
            label="Páginas de produtos"
          />
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting === null) {
            return;
          }

          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ variant: 'success', title: `${deleting.name} foi excluído` });
              setDeleting(null);
            },
            onError: (cause) => {
              // A recusa mais comum e "ha pedidos apontando para este
              // produto", e a frase do servidor diz **quantos**. Traduzi-la
              // aqui perderia o numero, que e o que faz a dona entender.
              toast({
                variant: 'danger',
                title: 'O produto não foi excluído',
                description: errorMessage(cause),
              });
              setDeleting(null);
            },
          });
        }}
        title="Excluir este produto?"
        description="O cadastro sai do painel e da vitrine, e não volta. Os pedidos já fechados continuam mostrando o que foi comprado — eles guardam nome e preço próprios."
        target={deleting?.name ?? ''}
        confirmLabel="Excluir o produto"
        loading={remove.isPending}
      />

      {/* Sem link para a vitrine aqui: o produto tem endereco publico, mas a
          tela de cadastro e que o mostra, ao lado do resto do que foi salvo. */}
    </div>
  );
}

/* ---- A busca --------------------------------------------------------------- */

/** Mesmo campo da tela de pedidos: responde a cada tecla, consulta na pausa. */
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
      label="Buscar produto"
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

/**
 * As opcoes do filtro, com a subcategoria recuada.
 *
 * O travessao antes do nome do filho e a unica indentacao que um `<option>`
 * aceita: espaco em branco no inicio e colapsado pelo navegador, e
 * `<optgroup>` nao pode ser escolhido — e a dona filtra por "Masculino"
 * tanto quanto por "Amadeirado".
 */
function optionsOf(tree: readonly AdminCategoryNode[]): { value: string; label: string }[] {
  return tree.flatMap((parent) => [
    { value: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ value: child.id, label: `— ${child.name}` })),
  ]);
}

/* ---- A linha de contagem ------------------------------------------------------ */

function summary(total: number | undefined, isPending: boolean, filtered: boolean): string {
  if (isPending || total === undefined) {
    return 'Carregando o catalogo';
  }

  const noun = total === 1 ? 'produto' : 'produtos';

  return filtered ? `${String(total)} ${noun} neste recorte` : `${String(total)} ${noun}`;
}
