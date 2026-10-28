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
  canDeleteForever,
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
  useSetProductsStatus,
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
 * O catálogo.
 *
 * ## A cena de uso
 *
 * Diferente da tela de pedidos, esta não e aberta com uma pergunta pronta.
 * Ela e aberta para **conferir**: o que acabou, o que esta fora do ar, o que
 * falta cadastrar da remessa que chegou. Por isso o primeiro controle depois
 * da busca e o status — "me mostre o que não esta no ar" — e a categoria vem
 * logo em seguida, que e como a dona pensa o estoque.
 *
 * ## O recorte mora no endereço
 *
 * Mesma regra da tela de pedidos, e pelo mesmo motivo prático: o card "Sem
 * estoque" da abertura do painel aponta para ca, e a dona manda o link de um
 * recorte para quem ajuda a conferir.
 *
 * ## Marcar linha e para o lote
 *
 * A remessa chegou e doze produtos saem do ar juntos; a promoção começou e
 * oito entram. O interruptor da linha resolve um de cada vez e continua ali
 * para isso — a seleção existe para quando "de cada vez" vira a tarefa.
 *
 * A seleção vale **a página**, e a barra diz isso com todas as letras. Ela
 * esvazia quando o recorte muda, porque marcar na busca por "Asad" e agir
 * depois de trocar o filtro seria agir no que não esta mais na tela. E o
 * comando leva só o que esta visível: se a lista voltou do servidor sem um
 * produto marcado, ele não entra no lote por ter sobrado na memória.
 *
 * ## O que o STAFF vê
 *
 * A lista, sem preço e sem editar. Ele consulta o catálogo para responder no
 * WhatsApp — "tem o de 100 ml?" — e essa pergunta se responde com nome,
 * variante e estoque. O interruptor, a seleção e o menu de ações não aparecem
 * para ele, e o backend recusa de todo jeito.
 */

/** O tempo que a digitação precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

/** Nenhuma linha marcada. Instancia única: `new Set()` a cada render trocaria
    a identidade da seleção e remontaria a tabela sem nada ter mudado. */
const EMPTY: ReadonlySet<string> = new Set();

/** A seleção e o recorte em que ela foi feita. Ver `AdminProductsPage`. */
interface Selection {
  slice: string;
  ids: ReadonlySet<string>;
}

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

  /*
   * Excluir e do administrador, e o menu da linha nem desenha o item quando
   * `onDelete` não vem — por isso a permissão aparece aqui como a decisão de
   * passar, ou não, o callback.
   *
   * O que o gerente faz no lugar esta ao lado, no mesmo menu: despublicar.
   * Tira da vitrine, mantem o cadastro e volta com um clique.
   */
  const canDelete = canDeleteForever(role);

  const { data, isPending, isFetching, isError, error } = useProducts(params);
  const { data: categories } = useAdminCategories();
  const setStatus = useSetProductStatus(params);
  const setStatuses = useSetProductsStatus(params);
  const remove = useDeleteProduct();

  const [deleting, setDeleting] = useState<AdminProduct | null>(null);

  /*
   * A seleção, carimbada com o recorte em que foi feita.
   *
   * Trocar o filtro, a busca ou a página esvazia a marcação: o que foi marcado
   * na página anterior não esta mais na tela, e um lote que age no invisível e
   * um lote que a dona não conferiu.
   *
   * O carimbo vive dentro do estado, e a zeragem acontece no render, porque a
   * alternativa — um efeito que chama `setPicked` quando o endereço muda — faz
   * a tela desenhar duas vezes a cada troca de filtro, uma delas com a seleção
   * velha por cima da lista nova.
   */
  const slice = search.toString();
  const [selection, setSelection] = useState<Selection>(() => ({ slice, ids: EMPTY }));
  const picked = selection.slice === slice ? selection.ids : EMPTY;

  const setPicked = (ids: ReadonlySet<string>): void => {
    setSelection({ slice, ids });
  };

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

  // A seleção cruzada com o que esta na tela. E ela que a barra conta e que o
  // comando leva — nunca o conjunto guardado, que pode citar produto que a
  // listagem já não devolve.
  const chosen = products.filter((product) => picked.has(product.id));

  const toggle = (id: string, on: boolean): void => {
    const next = new Set(picked);

    if (on) {
      next.add(id);
    } else {
      next.delete(id);
    }

    setPicked(next);
  };

  const publishChosen = (isActive: boolean): void => {
    const ids = chosen.map((product) => product.id);

    if (ids.length === 0) {
      return;
    }

    setStatuses.mutate(
      { ids, isActive },
      {
        onSuccess: ({ done, failed }) => {
          setPicked(new Set());

          if (failed === 0) {
            toast({ variant: 'success', title: batchSummary(done, isActive) });

            return;
          }

          // Recusa parcial não desfaz o que gravou: a frase conta os dois
          // lados, porque a lista abaixo dela já mostra o resultado misto.
          toast({
            variant: 'danger',
            title: batchSummary(done, isActive),
            description: `${failed === 1 ? '1 produto continuou' : `${failed} produtos continuaram`} como estava. Tente de novo ou confira linha por linha.`,
          });
        },
        onError: (cause) => {
          toast({
            variant: 'danger',
            title: 'Nenhum produto mudou',
            description: errorMessage(cause),
          });
        },
      },
    );
  };

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
                title={activeCount > 0 ? 'Nenhum produto neste recorte' : 'O catálogo esta vazio'}
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
                {...(canDelete ? { onDelete: setDeleting } : {})}
                selected={picked}
                onSelect={(product, on) => {
                  toggle(product.id, on);
                }}
                onSelectAll={(on) => {
                  setPicked(on ? new Set(products.map((product) => product.id)) : new Set());
                }}
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

          {/*
            A barra do lote gruda no pe da tela enquanto houver seleção.

            Mesma peca da tela de configurações, e pelo mesmo motivo: a lista
            rola, e quem marcou a décima linha não pode ter de rolar de volta
            ao topo para achar o comando. "Colocar no ar" e a ação cheia
            porque e a que publica; tirar do ar se desfaz com o mesmo clique.
          */}
          {chosen.length > 0 ? (
            <div className={styles.bulk}>
              <p className={styles.bulkText} aria-live="polite">
                <strong className={styles.bulkCount}>
                  {chosen.length === 1
                    ? '1 produto selecionado'
                    : `${chosen.length} produtos selecionados`}
                </strong>{' '}
                nesta página.
              </p>

              <div className={styles.bulkActions}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={setStatuses.isPending}
                  onClick={() => {
                    setPicked(new Set());
                  }}
                >
                  Limpar seleção
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={setStatuses.isPending}
                  onClick={() => {
                    publishChosen(false);
                  }}
                >
                  Tirar do ar
                </Button>

                <Button
                  type="button"
                  loading={setStatuses.isPending}
                  loadingLabel="Publicando"
                  onClick={() => {
                    publishChosen(true);
                  }}
                >
                  Colocar no ar
                </Button>
              </div>
            </div>
          ) : null}
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
              // A recusa mais comum e "há pedidos apontando para este
              // produto", e a frase do servidor diz **quantos**. Traduzi-lá
              // aqui perderia o número, que e o que faz a dona entender.
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
 * As opções do filtro, com a subcategoria recuada.
 *
 * O travessão antes do nome do filho e a única indentação que um `<option>`
 * aceita: espaço em branco no início e colapsado pelo navegador, e
 * `<optgroup>` não pode ser escolhido — e a dona filtra por "Masculino"
 * tanto quanto por "Amadeirado".
 */
function optionsOf(tree: readonly AdminCategoryNode[]): { value: string; label: string }[] {
  return tree.flatMap((parent) => [
    { value: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ value: child.id, label: `— ${child.name}` })),
  ]);
}

/* ---- O aviso do lote ---------------------------------------------------------- */

/**
 * O que o lote fez, em uma frase.
 *
 * Conta produtos e não cliques, e no singular também: "1 produto foi para o
 * ar" e a frase que a dona lê quando marcou um e mandou — e ela não pode
 * sair escrita no plural por economia de código.
 */
function batchSummary(count: number, isActive: boolean): string {
  const noun = count === 1 ? 'produto' : 'produtos';
  const verb = count === 1 ? 'foi' : 'foram';

  return isActive
    ? `${count} ${noun} ${verb} para o ar`
    : `${count} ${noun} ${verb} ${count === 1 ? 'tirado' : 'tirados'} do ar`;
}

/* ---- A linha de contagem ------------------------------------------------------ */

function summary(total: number | undefined, isPending: boolean, filtered: boolean): string {
  if (isPending || total === undefined) {
    return 'Carregando o catálogo';
  }

  const noun = total === 1 ? 'produto' : 'produtos';

  return filtered ? `${String(total)} ${noun} neste recorte` : `${String(total)} ${noun}`;
}
